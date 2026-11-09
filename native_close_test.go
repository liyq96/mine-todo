//go:build windows && nativeui

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"mine-todo/internal/store"
)

// Opt-in native integration test. It uses a hidden Wails window and an isolated
// APPDATA directory; normal unit tests never open a desktop window.
func TestNativeCloseFlush(t *testing.T) {
	base := os.Getenv("MINE_TODO_NATIVE_TEST_DIR")
	if base == "" {
		t.Skip("set MINE_TODO_NATIVE_TEST_DIR to an isolated artifact directory")
	}
	root, err := os.MkdirTemp(base, "native-close-")
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("APPDATA", root)
	app, err := NewApp()
	if err != nil {
		t.Fatal(err)
	}
	cfg := app.configManager.Current()
	expected := "Native close verification\n中文正文：自动保存等待期内立即关闭。"
	var probeMu sync.Mutex
	var probe map[string]interface{}
	var probeError error
	done := make(chan struct{})
	err = wails.Run(&options.App{
		Title: "Mine ToDo native regression", Width: 1080, Height: 780, StartHidden: true,
		AssetServer: &assetserver.Options{Assets: assets},
		Bind:        []interface{}{app}, OnBeforeClose: app.beforeClose, OnShutdown: app.shutdown,
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			runtime.EventsOn(ctx, "native:close-probe", func(args ...interface{}) {
				probeMu.Lock()
				defer probeMu.Unlock()
				if len(args) == 1 {
					probe, _ = args[0].(map[string]interface{})
				}
				if probe == nil {
					probeError = fmt.Errorf("missing native probe result")
				}
				if message, ok := probe["error"].(string); ok {
					probeError = fmt.Errorf("native probe: %s", message)
					app.mu.Lock()
					app.closeApproved = true
					app.mu.Unlock()
				}
			})
			go func() {
				deadline := time.NewTimer(40 * time.Second)
				defer deadline.Stop()
				for {
					app.mu.Lock()
					ready := app.frontendReady
					app.mu.Unlock()
					if ready {
						break
					}
					select {
					case <-done:
						return
					case <-deadline.C:
						probeMu.Lock()
						probeError = fmt.Errorf("native frontend did not become ready")
						probeMu.Unlock()
						app.mu.Lock()
						app.closeApproved = true
						app.mu.Unlock()
						runtime.Quit(ctx)
						return
					case <-time.After(25 * time.Millisecond):
					}
				}
				script := fmt.Sprintf(`(async () => {
  const wait = async (get) => { for (let i=0;i<150;i++) { const result=get(); if(result) return result; await new Promise(r=>setTimeout(r,20)); } throw Error('element timeout'); };
  const button = await wait(() => Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === '笔记'));
  button.click();
  (await wait(() => document.querySelector('.note-create-button'))).click();
  const input = await wait(() => document.querySelector('.note-content-input'));
  let writes = 0;
  const update = window.go.main.App.UpdateNote;
  window.go.main.App.UpdateNote = (...args) => { writes++; return update(...args); };
  input.focus();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input, %q);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,0));
  window.runtime.EventsEmit('native:close-probe',{writesBeforeClose:writes,value:input.value});
  window.runtime.Quit();
})().catch(error=>{ window.runtime.EventsEmit('native:close-probe',{error:String(error)}); window.runtime.Quit(); });`, expected)
				runtime.WindowExecJS(ctx, script)
				select {
				case <-done:
				case <-time.After(20 * time.Second):
					probeMu.Lock()
					probeError = fmt.Errorf("native close handshake timed out")
					probeMu.Unlock()
					app.mu.Lock()
					app.closeApproved = true
					app.mu.Unlock()
					runtime.Quit(ctx)
				}
			}()
		},
	})
	close(done)
	if err != nil {
		t.Fatal(err)
	}
	probeMu.Lock()
	defer probeMu.Unlock()
	if probeError != nil {
		t.Fatal(probeError)
	}
	if probe == nil || probe["writesBeforeClose"] != float64(0) {
		t.Fatalf("close was not inside debounce window: %v", probe)
	}
	manager, err := store.NewManager(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer manager.Close()
	notes, err := manager.ListNotes()
	if err != nil || len(notes) != 1 || notes[0].ContentMarkdown != expected {
		t.Fatalf("native close lost content: %v, %v", notes, err)
	}
	result, _ := json.MarshalIndent(map[string]interface{}{"passed": true, "databasePath": cfg.DBPath, "writesBeforeClose": probe["writesBeforeClose"], "persistedContent": notes[0].ContentMarkdown}, "", "  ")
	if err := os.WriteFile(filepath.Join(base, "native-close-result.json"), result, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Logf("native close flushed pending content into isolated database %s", cfg.DBPath)
}
