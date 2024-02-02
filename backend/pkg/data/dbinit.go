package data

import (
	"log"

	"github.com/huandu/go-sqlbuilder"
)

func (mgr *Manager) InitDB() {
	log.Print("Database initializing...")
	mgr.createUsersTable()
	mgr.createDevelopersTable()
	mgr.createGamesTable()
	mgr.createAdminsTable()
	mgr.createSessionsTable()
	mgr.createSavesTable()
	mgr.createGamesAuthorizedOriginsTable()
	mgr.createDeveloperMembersTable()
	mgr.createIPWhitelistTable()
	mgr.createIPBlocklistTable()
	log.Print("Database initialized!")
}

func (mgr *Manager) buildTable(tablename string, sb *sqlbuilder.CreateTableBuilder) {
	query, args := sb.Build()
	if _, err := mgr.DB.Query(query, args...); err != nil {
		log.Printf(`[FAILED] %s (%s)`, tablename, err)
	} else {
		log.Printf(`[PASSED] %s`, tablename)
	}
}

func (mgr *Manager) createGamesTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("games").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY UNIQUE NOT NULL`, // ULID string
		).
		Define(
			`developerid`,
			`CHAR(26) NOT NULL REFERENCES developers(id)`, // ULID string
		).
		Define(
			`name`,
			`TINYTEXT NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		).
		Define(
			`created`,
			`INTEGER(32) NOT NULL DEFAULT CURRENT_TIMESTAMP`, // UNIX Timestamp
		)
	mgr.buildTable("games", sb)
}

func (mgr *Manager) createDevelopersTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("developers").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY UNIQUE NOT NULL`, // ULID string
		).
		Define(
			`name`,
			`TINYTEXT NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		).
		Define(
			`created`,
			`INTEGER(32) NOT NULL DEFAULT UNIX_TIMESTAMP()`, // UNIX Timestamp
		)
	mgr.buildTable("developers", sb)
}

func (mgr *Manager) createUsersTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("users").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY UNIQUE NOT NULL`, // ULID string
		).
		Define(
			`username`,
			`TINYTEXT UNIQUE NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`gamertag`,
			`TINYTEXT UNIQUE NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`password`,
			`TINYTEXT NOT NULL DEFAULT ''`, // Scrypt hash
		).
		Define(
			`email`,
			`VARCHAR(320) UNIQUE NOT NULL DEFAULT ''`, // Longest (insane) email address is 320 characters long. But why would you do that to yourself?
		).
		Define(
			`created`,
			`INTEGER(32) NOT NULL DEFAULT UNIX_TIMESTAMP()`, // UNIX Timestamp
		)
	mgr.buildTable("users", sb)
}

func (mgr *Manager) createAdminsTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("admins").IfNotExists().
		Define(
			`userid`,
			`CHAR(26) NOT NULL REFERENCES users(id)`, // ULID string
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		).
		Define(
			`created`,
			`INTEGER(32) NOT NULL DEFAULT UNIX_TIMESTAMP()`, // UNIX Timestamp
		)
	mgr.buildTable("admins", sb)
}

func (mgr *Manager) createSessionsTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("sessions").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY UNIQUE NOT NULL`, // ULID string
		).
		Define(
			`userid`,
			`CHAR(26) NOT NULL REFERENCES users(id)`, // ULID string
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		).
		Define(
			`created`,
			`INTEGER(32) NOT NULL DEFAULT UNIX_TIMESTAMP()`, // UNIX Timestamp
		).
		Define(
			`expires`,
			`INTEGER(32) NOT NULL DEFAULT (UNIX_TIMESTAMP() + 86400)`, // UNIX Timestamp + 24 hours
		).
		Define(
			`origin`,
			`TINYTEXT NOT NULL DEFAULT ''`, // 255 maximum length, IP address
		)
	mgr.buildTable("sessions", sb)
}

func (mgr *Manager) createSavesTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("saves").IfNotExists().
		Define(
			`userid`,
			`CHAR(26) NOT NULL REFERENCES users(id)`, // ULID string
		).
		Define(
			`gameid`,
			`CHAR(26) NOT NULL REFERENCES games(id)`, // ULID string
		).
		Define(
			`slotid`,
			`TINYINT NOT NULL DEFAULT 0`, // 10 save slots, using 0-9 index.
		).
		Define(
			`contents`,
			`VARCHAR(10000) NOT NULL DEFAULT ''`, // Any desired format, within 10,000 characters
		)
	mgr.buildTable("saves", sb)
}

func (mgr *Manager) createGamesAuthorizedOriginsTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("games_authorized_origins").IfNotExists().
		Define(
			`gameid`,
			`CHAR(26) NOT NULL REFERENCES games(id)`, // ULID string
		).
		Define(
			`origin`,
			`TINYTEXT NOT NULL DEFAULT ''`, // IP address
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		)
	mgr.buildTable("games_authorized_origins", sb)
}

func (mgr *Manager) createDeveloperMembersTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("developer_members").IfNotExists().
		Define(
			`developerid`,
			`CHAR(26) NOT NULL REFERENCES developers(id)`, // ULID string
		).
		Define(
			`userid`,
			`CHAR(26) NOT NULL REFERENCES users(id)`, // ULID string
		)
	mgr.buildTable("developer_members", sb)
}

func (mgr *Manager) createIPBlocklistTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("ip_blocklist").IfNotExists().
		Define(
			`address`,
			`TINYTEXT NOT NULL`, // IP address
		)
	mgr.buildTable("ip_blocklist", sb)
}

func (mgr *Manager) createIPWhitelistTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("ip_whitelist").IfNotExists().
		Define(
			`address`,
			`TINYTEXT NOT NULL`, // IP address
		)
	mgr.buildTable("ip_whitelist", sb)
}
