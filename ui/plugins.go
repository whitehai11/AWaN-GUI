package ui

import "github.com/whitehai11/AWaN-GUI/api"

// ListPlugins returns installed plugins from AWaN Core.
func (a *App) ListPlugins() ([]api.PluginDefinition, error) {
	return a.client.ListPlugins()
}

// ListAvailablePlugins returns registry plugins from AWaN Core.
func (a *App) ListAvailablePlugins() ([]api.PluginDefinition, error) {
	return a.client.ListRegistryPlugins()
}

// SearchPlugins searches registry plugins via AWaN Core.
func (a *App) SearchPlugins(query string) ([]api.PluginDefinition, error) {
	return a.client.SearchPlugins(query)
}

// InstallPlugin installs a plugin and reloads the runtime plugin list.
func (a *App) InstallPlugin(name string) map[string]string {
	if err := a.client.InstallPlugin(name); err != nil {
		return map[string]string{"status": "error", "message": err.Error()}
	}
	return map[string]string{"status": "ok", "message": "Plugin installed"}
}

// RemovePlugin removes an installed plugin.
func (a *App) RemovePlugin(name string) map[string]string {
	if err := a.client.RemovePlugin(name); err != nil {
		return map[string]string{"status": "error", "message": err.Error()}
	}
	return map[string]string{"status": "ok", "message": "Plugin removed"}
}

// EnablePlugin enables an installed plugin.
func (a *App) EnablePlugin(name string) map[string]string {
	if err := a.client.EnablePlugin(name); err != nil {
		return map[string]string{"status": "error", "message": err.Error()}
	}
	return map[string]string{"status": "ok", "message": "Plugin enabled"}
}

// DisablePlugin disables an installed plugin.
func (a *App) DisablePlugin(name string) map[string]string {
	if err := a.client.DisablePlugin(name); err != nil {
		return map[string]string{"status": "error", "message": err.Error()}
	}
	return map[string]string{"status": "ok", "message": "Plugin disabled"}
}
