package store

import (
	"context"
	"errors"
	"time"

	"emboplot/backend/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

type MongoStore struct {
	client     *mongo.Client
	db         *mongo.Database
	users      *mongo.Collection
	characters *mongo.Collection
	stories    *mongo.Collection
	assets     *mongo.Collection
	rooms      *mongo.Collection
	profiles   *mongo.Collection
	points     *mongo.Collection
	payments   *mongo.Collection
}

func NewMongoStore(ctx context.Context, uri string, database string) (*MongoStore, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		_ = client.Disconnect(ctx)
		return nil, err
	}
	db := client.Database(database)
	return &MongoStore{
		client:     client,
		db:         db,
		users:      db.Collection("users"),
		characters: db.Collection("characters"),
		stories:    db.Collection("stories"),
		assets:     db.Collection("assets"),
		rooms:      db.Collection("rooms"),
		profiles:   db.Collection("profiles"),
		points:     db.Collection("point_transactions"),
		payments:   db.Collection("payment_orders"),
	}, nil
}

func (m *MongoStore) Disconnect(ctx context.Context) error {
	return m.client.Disconnect(ctx)
}

func (m *MongoStore) EnsureSeed(ctx context.Context) error {
	if err := m.ensureIndexes(ctx); err != nil {
		return err
	}

	seed := seedSnapshot()
	if err := m.syncSeedCatalogCreators(ctx, seed); err != nil {
		return err
	}

	count, err := m.characters.CountDocuments(ctx, bson.D{})
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	characters := make([]any, 0, len(seed.Characters)+len(seed.MarketCharacters))
	seen := map[string]bool{}
	for _, item := range append(seed.Characters, seed.MarketCharacters...) {
		if seen[item.ID] {
			continue
		}
		seen[item.ID] = true
		characters = append(characters, item)
	}
	if len(characters) > 0 {
		if _, err := m.characters.InsertMany(ctx, characters); err != nil {
			return err
		}
	}

	stories := make([]any, 0, len(seed.Stories))
	for _, item := range seed.Stories {
		stories = append(stories, item)
	}
	if len(stories) > 0 {
		if _, err := m.stories.InsertMany(ctx, stories); err != nil {
			return err
		}
	}

	assets := make([]any, 0, len(seed.Assets))
	for _, item := range seed.Assets {
		assets = append(assets, item)
	}
	if len(assets) > 0 {
		if _, err := m.assets.InsertMany(ctx, assets); err != nil {
			return err
		}
	}

	rooms := make([]any, 0, len(seed.Rooms))
	for _, item := range seed.Rooms {
		rooms = append(rooms, item)
	}
	if len(rooms) > 0 {
		if _, err := m.rooms.InsertMany(ctx, rooms); err != nil {
			return err
		}
	}

	_, err = m.profiles.InsertOne(ctx, seed.Profile)
	return err
}

func (m *MongoStore) syncSeedCatalogCreators(ctx context.Context, seed models.Bootstrap) error {
	globalSeedFilter := func(id string) bson.M {
		return bson.M{
			"id": id,
			"$or": bson.A{
				bson.M{"userId": ""},
				bson.M{"userId": bson.M{"$exists": false}},
			},
		}
	}
	for _, item := range append(seed.Characters, seed.MarketCharacters...) {
		if item.Creator == "" {
			continue
		}
		if _, err := m.characters.UpdateOne(ctx, globalSeedFilter(item.ID), bson.M{"$set": bson.M{"creator": item.Creator}}); err != nil {
			return err
		}
	}
	for _, item := range seed.Stories {
		if item.Creator == "" {
			continue
		}
		if _, err := m.stories.UpdateOne(ctx, globalSeedFilter(item.ID), bson.M{"$set": bson.M{"creator": item.Creator}}); err != nil {
			return err
		}
	}
	return nil
}

func (m *MongoStore) ensureIndexes(ctx context.Context) error {
	indexes := []struct {
		collection *mongo.Collection
		model      mongo.IndexModel
	}{
		{m.users, mongo.IndexModel{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{m.characters, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}}},
		{m.stories, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}}},
		{m.assets, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}}},
		{m.rooms, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}}},
		{m.profiles, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{m.points, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}}},
		{m.payments, mongo.IndexModel{Keys: bson.D{{Key: "tradeOrderId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{m.payments, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}}},
	}
	for _, item := range indexes {
		if _, err := item.collection.Indexes().CreateOne(ctx, item.model); err != nil {
			return err
		}
	}
	return nil
}

func (m *MongoStore) CreateUser(ctx context.Context, user models.User) (models.User, error) {
	if user.ID == "" {
		user.ID = NewID("user")
	}
	now := time.Now().UTC()
	if user.CreatedAt.IsZero() {
		user.CreatedAt = now
	}
	if user.UpdatedAt.IsZero() {
		user.UpdatedAt = now
	}
	if user.Status == "" {
		user.Status = "active"
	}
	if user.AvatarChar == "" {
		user.AvatarChar = "E"
	}
	if user.Points == 0 {
		user.Points = 300
	}
	if user.Tags == nil {
		user.Tags = []string{}
	}
	if _, err := m.users.InsertOne(ctx, user); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return models.User{}, ErrDuplicate
		}
		return models.User{}, err
	}
	if err := m.insertWorkspace(ctx, newUserWorkspace(user)); err != nil {
		_ = m.deleteUserWorkspace(ctx, user.ID)
		_, _ = m.users.DeleteOne(ctx, bson.M{"id": user.ID})
		return models.User{}, err
	}
	return user, nil
}

func (m *MongoStore) deleteUserWorkspace(ctx context.Context, userID string) error {
	collections := []*mongo.Collection{m.profiles, m.characters, m.stories, m.assets, m.rooms}
	for _, collection := range collections {
		if _, err := collection.DeleteMany(ctx, bson.M{"userId": userID}); err != nil {
			return err
		}
	}
	return nil
}

func (m *MongoStore) insertWorkspace(ctx context.Context, workspace userWorkspace) error {
	if _, err := m.profiles.InsertOne(ctx, workspace.Profile); err != nil {
		return err
	}
	if len(workspace.Characters) > 0 {
		items := make([]any, 0, len(workspace.Characters))
		for _, item := range workspace.Characters {
			items = append(items, item)
		}
		if _, err := m.characters.InsertMany(ctx, items); err != nil {
			return err
		}
	}
	if len(workspace.Stories) > 0 {
		items := make([]any, 0, len(workspace.Stories))
		for _, item := range workspace.Stories {
			items = append(items, item)
		}
		if _, err := m.stories.InsertMany(ctx, items); err != nil {
			return err
		}
	}
	if len(workspace.Assets) > 0 {
		items := make([]any, 0, len(workspace.Assets))
		for _, item := range workspace.Assets {
			items = append(items, item)
		}
		if _, err := m.assets.InsertMany(ctx, items); err != nil {
			return err
		}
	}
	if len(workspace.Rooms) > 0 {
		items := make([]any, 0, len(workspace.Rooms))
		for _, item := range workspace.Rooms {
			items = append(items, item)
		}
		if _, err := m.rooms.InsertMany(ctx, items); err != nil {
			return err
		}
	}
	return nil
}

func (m *MongoStore) GetUserByEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := m.users.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.User{}, ErrNotFound
	}
	return user, err
}

func (m *MongoStore) GetUserByID(ctx context.Context, id string) (models.User, error) {
	var user models.User
	err := m.users.FindOne(ctx, bson.M{"id": id}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.User{}, ErrNotFound
	}
	return user, err
}

func (m *MongoStore) UpdateUser(ctx context.Context, user models.User) (models.User, error) {
	user.UpdatedAt = time.Now().UTC()
	result, err := m.users.UpdateOne(ctx, bson.M{"id": user.ID}, bson.M{"$set": user})
	if err != nil {
		return models.User{}, err
	}
	if result.MatchedCount == 0 {
		return models.User{}, ErrNotFound
	}
	return user, nil
}

func (m *MongoStore) DebitPoints(ctx context.Context, userID string, amount int, reason string, metadata map[string]string) (models.Profile, error) {
	if amount <= 0 {
		return m.GetProfile(ctx, userID)
	}
	now := time.Now().UTC()
	var user models.User
	err := m.users.FindOneAndUpdate(
		ctx,
		bson.M{"id": userID, "points": bson.M{"$gte": amount}},
		bson.M{
			"$inc": bson.M{"points": -amount},
			"$set": bson.M{"updatedAt": now},
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		if _, lookupErr := m.GetUserByID(ctx, userID); lookupErr != nil {
			return models.Profile{}, lookupErr
		}
		return models.Profile{}, ErrInsufficientPoints
	}
	if err != nil {
		return models.Profile{}, err
	}
	return m.syncPointProfileAndRecord(ctx, user, -amount, reason, metadata, now)
}

func (m *MongoStore) CreditPoints(ctx context.Context, userID string, amount int, reason string, metadata map[string]string) (models.Profile, error) {
	if amount <= 0 {
		return m.GetProfile(ctx, userID)
	}
	now := time.Now().UTC()
	var user models.User
	err := m.users.FindOneAndUpdate(
		ctx,
		bson.M{"id": userID},
		bson.M{
			"$inc": bson.M{"points": amount},
			"$set": bson.M{"updatedAt": now},
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.Profile{}, ErrNotFound
	}
	if err != nil {
		return models.Profile{}, err
	}
	return m.syncPointProfileAndRecord(ctx, user, amount, reason, metadata, now)
}

func (m *MongoStore) ListPointTransactions(ctx context.Context, userID string, limit int) ([]models.PointTransaction, error) {
	if _, err := m.GetUserByID(ctx, userID); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	cursor, err := m.points.Find(
		ctx,
		bson.M{"userId": userID},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var items []models.PointTransaction
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return []models.PointTransaction{}, nil
	}
	return items, nil
}

func (m *MongoStore) SavePaymentOrder(ctx context.Context, userID string, order models.PaymentOrder) (models.PaymentOrder, error) {
	if _, err := m.GetUserByID(ctx, userID); err != nil {
		return models.PaymentOrder{}, err
	}
	now := time.Now().UTC()
	if order.ID == "" {
		order.ID = NewID("pay")
	}
	if order.TradeOrderID == "" {
		order.TradeOrderID = order.ID
	}
	order.UserID = userID
	if order.Provider == "" {
		order.Provider = "hupijiao"
	}
	if order.Status == "" {
		order.Status = "pending"
	}
	if order.CreatedAt.IsZero() {
		order.CreatedAt = now
	}
	order.UpdatedAt = now
	existing, err := m.GetPaymentOrderByTradeID(ctx, order.TradeOrderID)
	if err == nil && existing.ID != order.ID {
		return models.PaymentOrder{}, ErrDuplicate
	}
	if err != nil && !errors.Is(err, ErrNotFound) {
		return models.PaymentOrder{}, err
	}
	_, err = m.payments.UpdateOne(
		ctx,
		bson.M{"tradeOrderId": order.TradeOrderID},
		bson.M{"$set": order},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return models.PaymentOrder{}, ErrDuplicate
		}
		return models.PaymentOrder{}, err
	}
	return order, nil
}

func (m *MongoStore) GetPaymentOrderByTradeID(ctx context.Context, tradeOrderID string) (models.PaymentOrder, error) {
	var order models.PaymentOrder
	err := m.payments.FindOne(ctx, bson.M{"tradeOrderId": tradeOrderID}).Decode(&order)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.PaymentOrder{}, ErrNotFound
	}
	return order, err
}

func (m *MongoStore) MarkPaymentOrderPaid(ctx context.Context, tradeOrderID string, openOrderID string, transactionID string) (models.PaymentOrder, bool, error) {
	existing, err := m.GetPaymentOrderByTradeID(ctx, tradeOrderID)
	if err != nil {
		return models.PaymentOrder{}, false, err
	}
	wasPending := existing.Status != "paid"
	now := time.Now().UTC()
	update := bson.M{
		"$set": bson.M{
			"status":        "paid",
			"openOrderId":   firstNonEmpty(openOrderID, existing.OpenOrderID),
			"transactionId": firstNonEmpty(transactionID, existing.TransactionID),
			"updatedAt":     now,
		},
	}
	if existing.PaidAt == nil {
		update["$set"].(bson.M)["paidAt"] = now
	}
	var order models.PaymentOrder
	err = m.payments.FindOneAndUpdate(
		ctx,
		bson.M{"tradeOrderId": tradeOrderID},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&order)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.PaymentOrder{}, false, ErrNotFound
	}
	if err != nil {
		return models.PaymentOrder{}, false, err
	}
	return order, wasPending, nil
}

func (m *MongoStore) syncPointProfileAndRecord(ctx context.Context, user models.User, delta int, reason string, metadata map[string]string, now time.Time) (models.Profile, error) {
	var profile models.Profile
	err := m.profiles.FindOneAndUpdate(
		ctx,
		bson.M{"userId": user.ID},
		bson.M{"$set": bson.M{"points": user.Points, "updatedAt": now}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&profile)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.Profile{}, ErrNotFound
	}
	if err != nil {
		return models.Profile{}, err
	}
	transaction := models.PointTransaction{
		ID:           NewID("ptx"),
		UserID:       user.ID,
		Delta:        delta,
		BalanceAfter: user.Points,
		Reason:       reason,
		Metadata:     cloneMetadata(metadata),
		CreatedAt:    now,
	}
	if _, err := m.points.InsertOne(ctx, transaction); err != nil {
		return models.Profile{}, err
	}
	return profile, nil
}

func (m *MongoStore) Bootstrap(ctx context.Context, userID string) (models.Bootstrap, error) {
	characters, err := m.ListCharacters(ctx, "mine", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	marketCharacters, err := m.ListCharacters(ctx, "market", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	stories, err := m.ListStories(ctx, "mine", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	marketStories, err := m.ListStories(ctx, "market", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	assets, err := m.ListAssets(ctx, userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	rooms, err := m.ListRooms(ctx, userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	profile, err := m.GetProfile(ctx, userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	return models.Bootstrap{
		Profile:          profile,
		Characters:       characters,
		MarketCharacters: marketCharacters,
		Stories:          stories,
		MarketStories:    marketStories,
		Assets:           assets,
		Rooms:            rooms,
	}, nil
}

func (m *MongoStore) ListCharacters(ctx context.Context, scope string, userID string) ([]models.Character, error) {
	filter := bson.M{}
	if scope == "market" {
		filter["isPublic"] = true
	} else {
		filter["userId"] = userID
	}
	var items []models.Character
	if err := findAll(ctx, m.characters, filter, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return []models.Character{}, nil
	}
	return items, nil
}

func (m *MongoStore) SaveCharacter(ctx context.Context, userID string, item models.Character) (models.Character, error) {
	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = NewID("char")
	} else {
		existing, err := m.getCharacter(ctx, userID, item.ID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return models.Character{}, err
		}
		if err == nil {
			if characterPublishedLocked(existing) {
				return models.Character{}, ErrPublishedLocked
			}
			item.CreatedAt = existing.CreatedAt
		}
	}
	item.UserID = userID
	if item.Status == "" {
		item.Status = "idle"
	}
	if item.VoiceName == "" {
		item.VoiceName = "Kore"
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	_, err := m.characters.UpdateOne(ctx, bson.M{"id": item.ID, "userId": userID}, bson.M{"$set": item}, options.UpdateOne().SetUpsert(true))
	return item, err
}

func (m *MongoStore) UpdateCharacter(ctx context.Context, userID string, id string, item models.Character) (models.Character, error) {
	existing, err := m.getCharacter(ctx, userID, id)
	if err != nil {
		return models.Character{}, err
	}
	if characterPublishedLocked(existing) {
		return models.Character{}, ErrPublishedLocked
	}
	item.ID = id
	item.UserID = userID
	item.CreatedAt = existing.CreatedAt
	item.IsPublic = existing.IsPublic
	item.PublishedAt = existing.PublishedAt
	item.UpdatedAt = time.Now().UTC()
	if item.Status == "" {
		item.Status = existing.Status
	}
	if _, err := m.characters.UpdateOne(ctx, bson.M{"id": id, "userId": userID}, bson.M{"$set": item}); err != nil {
		return models.Character{}, err
	}
	return item, nil
}

func (m *MongoStore) DeleteCharacter(ctx context.Context, userID string, id string) error {
	existing, err := m.getCharacter(ctx, userID, id)
	if err != nil {
		return err
	}
	if existing.IsPublic {
		return ErrPublishedLocked
	}
	result, err := m.characters.DeleteOne(ctx, bson.M{"id": id, "userId": userID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (m *MongoStore) PublishCharacter(ctx context.Context, userID string, id string) (models.Character, error) {
	item, err := m.getCharacter(ctx, userID, id)
	if err != nil {
		return models.Character{}, err
	}
	now := time.Now().UTC()
	item.IsPublic = true
	if item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.UpdatedAt = now
	if _, err := m.characters.UpdateOne(ctx, bson.M{"id": id, "userId": userID}, bson.M{"$set": visibilityUpdateSet(item.IsPublic, item.PublishedAt, item.UpdatedAt)}); err != nil {
		return models.Character{}, err
	}
	return item, nil
}

func (m *MongoStore) UnpublishCharacter(ctx context.Context, userID string, id string) (models.Character, error) {
	item, err := m.getCharacter(ctx, userID, id)
	if err != nil {
		return models.Character{}, err
	}
	now := time.Now().UTC()
	if item.IsPublic && item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.IsPublic = false
	item.UpdatedAt = now
	if _, err := m.characters.UpdateOne(ctx, bson.M{"id": id, "userId": userID}, bson.M{"$set": visibilityUpdateSet(item.IsPublic, item.PublishedAt, item.UpdatedAt)}); err != nil {
		return models.Character{}, err
	}
	return item, nil
}

func (m *MongoStore) AcquireCharacter(ctx context.Context, userID string, id string) (models.Character, error) {
	source, err := m.getPublicCharacter(ctx, id)
	if err != nil {
		return models.Character{}, err
	}
	user, err := m.GetUserByID(ctx, userID)
	if err != nil {
		return models.Character{}, err
	}
	now := time.Now().UTC()
	item := source
	item.ID = NewID("char")
	item.UserID = userID
	item.Creator = user.Nickname
	item.IsPublic = false
	item.PublishedAt = nil
	item.CreatedAt = now
	item.UpdatedAt = now
	if item.Status == "" {
		item.Status = "idle"
	}
	if item.VoiceName == "" {
		item.VoiceName = "Kore"
	}
	_, err = m.characters.InsertOne(ctx, item)
	return item, err
}

func (m *MongoStore) ListStories(ctx context.Context, scope string, userID string) ([]models.StorySetting, error) {
	filter := bson.M{}
	if scope == "market" {
		filter["isPublic"] = true
	} else {
		filter["userId"] = userID
	}
	var items []models.StorySetting
	if err := findAll(ctx, m.stories, filter, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return []models.StorySetting{}, nil
	}
	return items, nil
}

func (m *MongoStore) SaveStory(ctx context.Context, userID string, item models.StorySetting) (models.StorySetting, error) {
	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = NewID("story")
	} else {
		existing, err := m.getStory(ctx, userID, item.ID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return models.StorySetting{}, err
		}
		if err == nil {
			if storyPublishedLocked(existing) {
				return models.StorySetting{}, ErrPublishedLocked
			}
			item.CreatedAt = existing.CreatedAt
		}
	}
	item.UserID = userID
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	_, err := m.stories.UpdateOne(ctx, bson.M{"id": item.ID, "userId": userID}, bson.M{"$set": item}, options.UpdateOne().SetUpsert(true))
	return item, err
}

func (m *MongoStore) DeleteStory(ctx context.Context, userID string, id string) error {
	existing, err := m.getStory(ctx, userID, id)
	if err != nil {
		return err
	}
	if existing.IsPublic {
		return ErrPublishedLocked
	}
	result, err := m.stories.DeleteOne(ctx, bson.M{"id": id, "userId": userID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (m *MongoStore) PublishStory(ctx context.Context, userID string, id string) (models.StorySetting, error) {
	item, err := m.getStory(ctx, userID, id)
	if err != nil {
		return models.StorySetting{}, err
	}
	now := time.Now().UTC()
	item.IsPublic = true
	if item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.UpdatedAt = now
	if _, err := m.stories.UpdateOne(ctx, bson.M{"id": id, "userId": userID}, bson.M{"$set": visibilityUpdateSet(item.IsPublic, item.PublishedAt, item.UpdatedAt)}); err != nil {
		return models.StorySetting{}, err
	}
	return item, nil
}

func (m *MongoStore) UnpublishStory(ctx context.Context, userID string, id string) (models.StorySetting, error) {
	item, err := m.getStory(ctx, userID, id)
	if err != nil {
		return models.StorySetting{}, err
	}
	now := time.Now().UTC()
	if item.IsPublic && item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.IsPublic = false
	item.UpdatedAt = now
	if _, err := m.stories.UpdateOne(ctx, bson.M{"id": id, "userId": userID}, bson.M{"$set": visibilityUpdateSet(item.IsPublic, item.PublishedAt, item.UpdatedAt)}); err != nil {
		return models.StorySetting{}, err
	}
	return item, nil
}

func (m *MongoStore) AcquireStory(ctx context.Context, userID string, id string) (models.StorySetting, error) {
	source, err := m.getPublicStory(ctx, id)
	if err != nil {
		return models.StorySetting{}, err
	}
	user, err := m.GetUserByID(ctx, userID)
	if err != nil {
		return models.StorySetting{}, err
	}
	now := time.Now().UTC()
	item := source
	item.ID = NewID("story")
	item.UserID = userID
	item.Creator = user.Nickname
	item.IsPublic = false
	item.PublishedAt = nil
	item.CreatedAt = now
	item.UpdatedAt = now
	_, err = m.stories.InsertOne(ctx, item)
	return item, err
}

func (m *MongoStore) ListAssets(ctx context.Context, userID string) ([]models.Asset, error) {
	var items []models.Asset
	if err := findAll(ctx, m.assets, bson.M{"userId": userID}, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return []models.Asset{}, nil
	}
	return items, nil
}

func (m *MongoStore) ListRooms(ctx context.Context, userID string) ([]models.Room, error) {
	var items []models.Room
	if err := findAll(ctx, m.rooms, bson.M{"userId": userID}, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return []models.Room{}, nil
	}
	return items, nil
}

func (m *MongoStore) GetRoom(ctx context.Context, userID string, id string) (models.Room, error) {
	var room models.Room
	err := m.rooms.FindOne(ctx, bson.M{"id": id, "userId": userID}).Decode(&room)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.Room{}, ErrNotFound
	}
	return room, err
}

func (m *MongoStore) SaveRoom(ctx context.Context, userID string, item models.Room) (models.Room, error) {
	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = NewID("room")
	}
	item.UserID = userID
	if item.Status == "" {
		item.Status = "running"
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	_, err := m.rooms.UpdateOne(ctx, bson.M{"id": item.ID, "userId": userID}, bson.M{"$set": item}, options.UpdateOne().SetUpsert(true))
	return item, err
}

func (m *MongoStore) UpdateRoom(ctx context.Context, userID string, id string, item models.Room) (models.Room, error) {
	existing, err := m.GetRoom(ctx, userID, id)
	if err != nil {
		return models.Room{}, err
	}
	item.ID = id
	item.UserID = userID
	item.CreatedAt = existing.CreatedAt
	item.UpdatedAt = time.Now().UTC()
	if item.Title == "" {
		item.Title = existing.Title
	}
	if item.Status == "" {
		item.Status = existing.Status
	}
	if item.StoryID == "" {
		item.StoryID = existing.StoryID
		item.CurrentStory = existing.CurrentStory
	}
	if len(item.CharacterIDs) == 0 {
		item.CharacterIDs = existing.CharacterIDs
		item.ActiveChars = existing.ActiveChars
	}
	if len(item.ScriptTimeline) == 0 {
		item.ScriptTimeline = existing.ScriptTimeline
	}
	result, err := m.rooms.UpdateOne(ctx, bson.M{"id": id, "userId": userID}, bson.M{"$set": item})
	if err != nil {
		return models.Room{}, err
	}
	if result.MatchedCount == 0 {
		return models.Room{}, ErrNotFound
	}
	return item, nil
}

func (m *MongoStore) DeleteRoom(ctx context.Context, userID string, id string) error {
	result, err := m.rooms.DeleteOne(ctx, bson.M{"id": id, "userId": userID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (m *MongoStore) AppendLine(ctx context.Context, userID string, roomID string, line models.ScriptLine) (models.Room, error) {
	if line.ID == "" {
		line.ID = NewID("line")
	}
	if line.CreatedAt == 0 {
		line.CreatedAt = time.Now().UnixMilli()
	}
	_, err := m.rooms.UpdateOne(
		ctx,
		bson.M{"id": roomID, "userId": userID},
		bson.M{
			"$push": bson.M{"scriptTimeline": line},
			"$set":  bson.M{"updatedAt": time.Now().UTC()},
		},
	)
	if err != nil {
		return models.Room{}, err
	}
	return m.GetRoom(ctx, userID, roomID)
}

func (m *MongoStore) UpdateLineMedia(ctx context.Context, userID string, roomID string, lineID string, imageURL *string, audioURL *string) (models.Room, error) {
	set := bson.M{"updatedAt": time.Now().UTC()}
	if imageURL != nil {
		set["scriptTimeline.$.imageUrl"] = *imageURL
	}
	if audioURL != nil {
		set["scriptTimeline.$.audioUrl"] = *audioURL
	}
	result, err := m.rooms.UpdateOne(
		ctx,
		bson.M{"id": roomID, "userId": userID, "scriptTimeline.id": lineID},
		bson.M{"$set": set},
	)
	if err != nil {
		return models.Room{}, err
	}
	if result.MatchedCount == 0 {
		return models.Room{}, ErrNotFound
	}
	return m.GetRoom(ctx, userID, roomID)
}

func (m *MongoStore) GetProfile(ctx context.Context, userID string) (models.Profile, error) {
	var profile models.Profile
	err := m.profiles.FindOne(ctx, bson.M{"userId": userID}).Decode(&profile)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.Profile{}, ErrNotFound
	}
	return profile, err
}

func (m *MongoStore) UpdateProfile(ctx context.Context, userID string, profile models.Profile) (models.Profile, error) {
	existing, err := m.GetProfile(ctx, userID)
	if err != nil {
		return models.Profile{}, err
	}
	if profile.ID == "" {
		profile.ID = existing.ID
	}
	profile.UserID = userID
	profile.Email = existing.Email
	if profile.UID == "" {
		profile.UID = existing.UID
	}
	profile.Points = existing.Points
	profile.UpdatedAt = time.Now().UTC()
	_, err = m.profiles.UpdateOne(ctx, bson.M{"userId": userID}, bson.M{"$set": profile}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return models.Profile{}, err
	}
	_, err = m.users.UpdateOne(ctx, bson.M{"id": userID}, bson.M{"$set": bson.M{
		"nickname":   profile.Nickname,
		"avatarChar": profile.AvatarChar,
		"avatarUrl":  profile.AvatarURL,
		"signature":  profile.Signature,
		"tags":       profile.Tags,
		"points":     profile.Points,
		"updatedAt":  profile.UpdatedAt,
	}})
	return profile, err
}

func (m *MongoStore) getCharacter(ctx context.Context, userID string, id string) (models.Character, error) {
	var item models.Character
	err := m.characters.FindOne(ctx, bson.M{"id": id, "userId": userID}).Decode(&item)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.Character{}, ErrNotFound
	}
	return item, err
}

func (m *MongoStore) getPublicCharacter(ctx context.Context, id string) (models.Character, error) {
	var item models.Character
	err := m.characters.FindOne(ctx, bson.M{"id": id, "isPublic": true}).Decode(&item)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.Character{}, ErrNotFound
	}
	return item, err
}

func (m *MongoStore) getStory(ctx context.Context, userID string, id string) (models.StorySetting, error) {
	var item models.StorySetting
	err := m.stories.FindOne(ctx, bson.M{"id": id, "userId": userID}).Decode(&item)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.StorySetting{}, ErrNotFound
	}
	return item, err
}

func (m *MongoStore) getPublicStory(ctx context.Context, id string) (models.StorySetting, error) {
	var item models.StorySetting
	err := m.stories.FindOne(ctx, bson.M{"id": id, "isPublic": true}).Decode(&item)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.StorySetting{}, ErrNotFound
	}
	return item, err
}

func visibilityUpdateSet(isPublic bool, publishedAt *time.Time, updatedAt time.Time) bson.M {
	return bson.M{
		"isPublic":    isPublic,
		"publishedAt": publishedAt,
		"updatedAt":   updatedAt,
	}
}

func findAll[T any](ctx context.Context, collection *mongo.Collection, filter any, out *[]T) error {
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)
	return cursor.All(ctx, out)
}
