package main

import (
	"context"
	"embed"
	"log"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"github.com/awan/awan-gui/api"
	"github.com/awan/awan-gui/internal/updater"
	"github.com/awan/awan-gui/ui"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	client := api.NewCoreClient("")
	app := ui.NewApp(client)

	updater.StartBackground(updater.Options{
		AppName:        "AWaN GUI",
		Repo:           "awan/gui",
		Version:        Version,
		BinaryBaseName: "awan-gui",
		Args:           os.Args[1:],
		Logger: func(message string) {
			log.Println("[AWAN]", message)
		},
	})

	if err := wails.Run(&options.App{
		Title:  "AWaN GUI",
		Width:  1440,
		Height: 920,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 245, G: 241, B: 232, A: 1},
		OnStartup: func(ctx context.Context) {
			app.Startup(ctx)
		},
		Bind: []interface{}{
			app,
		},
	}); err != nil {
		log.Fatal(err)
	}
}
