package data

import (
	"database/sql"
	"log"
)

type Manager struct {
	DB *sql.DB
}

func New(sqlDriver string, sqlUrl string) *Manager {
	db, err := sql.Open(sqlDriver, sqlUrl)

	if err != nil {
		log.Fatal("Failed to open database:", err)
		return nil
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
		return nil
	}

	log.Printf("Successfully connected to database")

	// Create manager
	mgr := &Manager{
		DB: db,
	}

	// Return manager
	return mgr
}
