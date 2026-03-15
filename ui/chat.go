package ui

import (
	"context"
	"strings"
	"time"
)

// ChatMessage is rendered by the desktop frontend.
type ChatMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

// RunAgent sends a chat prompt to the runtime and returns the response message.
func (a *App) RunAgent(prompt string) (*ChatMessage, error) {
	response, err := a.client.RunAgent(prompt, a.currentAgent, a.currentModel)
	if err != nil {
		return nil, err
	}

	message := &ChatMessage{
		Role:      "assistant",
		Content:   strings.TrimSpace(response.Output),
		Timestamp: time.Now().Format(time.RFC3339),
	}
	a.lastMessages = append(a.lastMessages, ChatMessage{
		Role:      "user",
		Content:   strings.TrimSpace(prompt),
		Timestamp: time.Now().Format(time.RFC3339),
	}, *message)

	return message, nil
}

// GetChatHistory returns the recent chat state held by the GUI.
func (a *App) GetChatHistory() []ChatMessage {
	history := make([]ChatMessage, len(a.lastMessages))
	copy(history, a.lastMessages)
	return history
}

func (a *App) ensureContext() context.Context {
	if a.ctx == nil {
		return context.Background()
	}
	return a.ctx
}
