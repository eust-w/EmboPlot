package api

import (
	"context"

	"emboplot/backend/internal/models"
)

type contextKey string

const currentUserKey contextKey = "currentUser"

func contextWithUser(ctx context.Context, user models.User) context.Context {
	return context.WithValue(ctx, currentUserKey, user)
}

func currentUser(ctx context.Context) models.User {
	user, _ := ctx.Value(currentUserKey).(models.User)
	return user
}

func currentUserID(ctx context.Context) string {
	return currentUser(ctx).ID
}
