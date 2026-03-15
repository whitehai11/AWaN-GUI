package ui

import "github.com/whitehai11/AWaN-GUI/api"

// GetMemory returns the current memory snapshot for the selected agent.
func (a *App) GetMemory() (*api.MemorySnapshot, error) {
	return a.client.GetMemory(a.currentAgent)
}

// GetFiles returns the lightweight runtime file listing.
func (a *App) GetFiles() ([]string, error) {
	return a.client.ListFiles()
}
