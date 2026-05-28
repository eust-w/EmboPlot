package store

import (
	"context"
	"errors"

	"emboplot/backend/internal/models"
)

var ErrNotFound = errors.New("not found")
var ErrDuplicate = errors.New("duplicate")
var ErrPublishedLocked = errors.New("published assets cannot be modified")
var ErrInsufficientPoints = errors.New("insufficient points")

type Repository interface {
	EnsureSeed(context.Context) error
	CreateUser(context.Context, models.User) (models.User, error)
	GetUserByEmail(context.Context, string) (models.User, error)
	GetUserByID(context.Context, string) (models.User, error)
	UpdateUser(context.Context, models.User) (models.User, error)
	DebitPoints(context.Context, string, int, string, map[string]string) (models.Profile, error)
	CreditPoints(context.Context, string, int, string, map[string]string) (models.Profile, error)
	ListPointTransactions(context.Context, string, int) ([]models.PointTransaction, error)
	Bootstrap(context.Context, string) (models.Bootstrap, error)
	ListCharacters(context.Context, string, string) ([]models.Character, error)
	SaveCharacter(context.Context, string, models.Character) (models.Character, error)
	UpdateCharacter(context.Context, string, string, models.Character) (models.Character, error)
	PublishCharacter(context.Context, string, string) (models.Character, error)
	UnpublishCharacter(context.Context, string, string) (models.Character, error)
	AcquireCharacter(context.Context, string, string) (models.Character, error)
	ListStories(context.Context, string, string) ([]models.StorySetting, error)
	SaveStory(context.Context, string, models.StorySetting) (models.StorySetting, error)
	PublishStory(context.Context, string, string) (models.StorySetting, error)
	UnpublishStory(context.Context, string, string) (models.StorySetting, error)
	AcquireStory(context.Context, string, string) (models.StorySetting, error)
	ListAssets(context.Context, string) ([]models.Asset, error)
	ListRooms(context.Context, string) ([]models.Room, error)
	GetRoom(context.Context, string, string) (models.Room, error)
	SaveRoom(context.Context, string, models.Room) (models.Room, error)
	UpdateRoom(context.Context, string, string, models.Room) (models.Room, error)
	DeleteRoom(context.Context, string, string) error
	AppendLine(context.Context, string, string, models.ScriptLine) (models.Room, error)
	GetProfile(context.Context, string) (models.Profile, error)
	UpdateProfile(context.Context, string, models.Profile) (models.Profile, error)
}
