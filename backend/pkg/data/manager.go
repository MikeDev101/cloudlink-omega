package data

import (
	"context"
	"database/sql"
	"log"

	"github.com/redis/go-redis/v9"
)

type Manager struct {
	Ctx   context.Context
	DB    *sql.DB
	Redis *redis.Client
}

func New(sqlDriver string, sqlUrl string, redisUrl string) *Manager {
	// Create background context
	ctx := context.Background()

	log.Println("[Data Manager] Connecting to DB and Redis, please wait...")

	// Open database
	db, err := sql.Open(sqlDriver, sqlUrl)
	if err != nil {
		log.Fatal("[Data Manager] Failed to connect to DB: ", err)
	}

	// Verify connection to database
	err = db.Ping()
	if err != nil {
		log.Fatal("[Data Manager] Failed to connect to DB: ", err)
	}

	log.Println("[Data Manager] Successfully connected to DB.")

	// Connect to Redis
	rdbOpts, err := redis.ParseURL(redisUrl)
	if err != nil {
		log.Fatal("[Data Manager] Failed to parse Redis URL: ", err)
	}

	rdb := redis.NewClient(rdbOpts)

	// Ping Redis
	if err = rdb.Ping(ctx).Err(); err != nil {
		log.Fatal("[Data Manager] Failed to connect to Redis: ", err)
	}

	log.Println("[Data Manager] Successfully connected to Redis.")

	// Return manager
	return &Manager{
		DB:    db,
		Ctx:   ctx,
		Redis: rdb,
	}
}
