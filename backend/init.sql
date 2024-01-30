-- Adminer 4.8.1 MySQL 11.2.2-MariaDB-1:11.2.2+maria~deb12 dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE `clomega` /*!40100 DEFAULT CHARACTER SET utf16 COLLATE utf16_unicode_ci */;
USE `clomega`;

DELIMITER ;;

DROP FUNCTION IF EXISTS `createUser`;;
CREATE FUNCTION `createUser`(`usernameParam` tinytext, `passwordParam` tinytext, `gamertagParam` tinytext, `emailParam` tinytext) RETURNS char(26) CHARSET utf16 COLLATE utf16_unicode_ci
BEGIN
    DECLARE userUlid CHAR(26);

    -- Check if the email is unique
    IF (SELECT COUNT(*) FROM users WHERE email = emailParam) != 0 THEN
       SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'EMAIL_IN_USE';
    END IF;

    -- Check if the username is unique
    IF (SELECT COUNT(*) FROM users WHERE username = usernameParam) != 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USERNAME_TAKEN';
    END IF;

    -- Set user ULID
    SET userUlid = ULID_FROM_DATETIME(NOW());

    -- If both username and email are unique, insert the new user
    INSERT INTO users (id, username, password, gamertag, email, created)
    VALUES (userUlid, usernameParam, passwordParam, gamertagParam, emailParam, NOW());

    RETURN 'OK';
END;;

DROP FUNCTION IF EXISTS `ULID_DECODE`;;
CREATE FUNCTION `ULID_DECODE`(s CHAR(26)) RETURNS binary(16)
    DETERMINISTIC
BEGIN
DECLARE s_base32 CHAR(26);
SET s_base32 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(s), 'J', 'I'), 'K', 'J'), 'M', 'K'), 'N', 'L'), 'P', 'M'), 'Q', 'N'), 'R', 'O'), 'S', 'P'), 'T', 'Q'), 'V', 'R'), 'W', 'S'), 'X', 'T'), 'Y', 'U'), 'Z', 'V');
RETURN UNHEX(CONCAT(LPAD(CONV(SUBSTRING(s_base32, 1, 2), 32, 16), 2, '0'), LPAD(CONV(SUBSTRING(s_base32, 3, 12), 32, 16), 15, '0'), LPAD(CONV(SUBSTRING(s_base32, 15, 12), 32, 16), 15, '0')));
END;;

DROP FUNCTION IF EXISTS `ULID_ENCODE`;;
CREATE FUNCTION `ULID_ENCODE`(b BINARY(16)) RETURNS char(26) CHARSET utf16 COLLATE utf16_unicode_ci
    DETERMINISTIC
BEGIN
DECLARE s_hex CHAR(32);
SET s_hex = LPAD(HEX(b), 32, '0');
RETURN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LPAD(CONV(SUBSTRING(s_hex, 1, 2), 16, 32), 2, '0'), LPAD(CONV(SUBSTRING(s_hex, 3, 15), 16, 32), 12, '0'), LPAD(CONV(SUBSTRING(s_hex, 18, 15), 16, 32), 12, '0')), 'V', 'Z'), 'U', 'Y'), 'T', 'X'), 'S', 'W'), 'R', 'V'), 'Q', 'T'), 'P', 'S'), 'O', 'R'), 'N', 'Q'), 'M', 'P'), 'L', 'N'), 'K', 'M'), 'J', 'K'), 'I', 'J');
END;;

DROP FUNCTION IF EXISTS `ULID_FROM_DATETIME`;;
CREATE FUNCTION `ULID_FROM_DATETIME`(`t` datetime) RETURNS char(26) CHARSET utf16 COLLATE utf16_unicode_ci
    DETERMINISTIC
BEGIN
RETURN ULID_ENCODE(CONCAT(UNHEX(CONV(UNIX_TIMESTAMP(t) * 1000, 10, 16)), RANDOM_BYTES(10)));
END;;

DROP FUNCTION IF EXISTS `ULID_TO_DATETIME`;;
CREATE FUNCTION `ULID_TO_DATETIME`(s CHAR(26)) RETURNS datetime
    DETERMINISTIC
BEGIN
RETURN FROM_UNIXTIME(CONV(HEX(LEFT(ULID_DECODE(s), 6)), 16, 10) / 1000);
END;;

DROP PROCEDURE IF EXISTS `addAdmin`;;
CREATE PROCEDURE `addAdmin`(IN `userUlid` char(26))
BEGIN
    -- Check if the user ULID exists
    IF (SELECT COUNT(*) FROM users WHERE id = userUlid) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_ULID_NOTFOUND';
    END IF;

    IF (SELECT COUNT(*) FROM admins WHERE userid = userUlid) != 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ADMIN_ALREADY_ADDED';
    END IF;

    -- Insert into admins
    INSERT INTO admins (userid)
    VALUES (userUlid);

    SELECT 'OK' AS result;
END;;

DROP PROCEDURE IF EXISTS `addDeveloperMember`;;
CREATE PROCEDURE `addDeveloperMember`(IN `developerUlidParam` char(26), IN `userUlidParam` char(26))
BEGIN
    DECLARE memberExists INT;
    
    -- Check if ULID is valid
    IF (SELECT COUNT(*) FROM users WHERE id = userUlidParam) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_ULID_NOTFOUND';
    END IF;

    -- Get developer ID based on ULID
    IF (SELECT COUNT(*) FROM developers WHERE id = developerUlidParam) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'DEVELOPER_ULID_NOTFOUND';
    END IF;

    -- Check if the user is already a member of that developer, if the member doesn't exist, add them and finish the procedure
    IF (SELECT COUNT(*) FROM developers_members WHERE developerid = developerUlidParam AND userid = userUlidParam) = 0 THEN
        INSERT INTO developers_members (developerid, userid)
        VALUES (developerUlidParam, userUlidParam);
        SELECT 'OK' AS result;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_ALREADY_MEMBER';
    END IF;
END;;

DROP PROCEDURE IF EXISTS `createDeveloper`;;
CREATE PROCEDURE `createDeveloper`(IN `nameParam` tinytext, OUT `ulidParam` char(26))
BEGIN
    -- Create developer entry
    SET ulidParam = ULID_FROM_DATETIME(NOW());
    INSERT INTO developers (id, name)
    VALUES (ulidParam, nameParam);

    SELECT 'OK' AS result;
END;;

DROP PROCEDURE IF EXISTS `createGame`;;
CREATE PROCEDURE `createGame`(IN `developerUlidParam` char(26), IN `gameName` tinytext)
BEGIN
    DECLARE gameUlid CHAR(26);

    -- Get developer ID based on ULID
    IF (SELECT COUNT(*) FROM developers WHERE id = developerUlidParam) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'DEVELOPER_ULID_NOTFOUND';
    END IF;

    -- Create the game entry ---
    SET gameUlid = ULID_FROM_DATETIME(NOW());
    INSERT INTO games(id, developerid, name, created)
        VALUES (gameUlid, developerUlidParam, gameName, NOW());
        SELECT 'OK' AS result;
END;;

DROP PROCEDURE IF EXISTS `createSession`;;
CREATE PROCEDURE `createSession`(IN `userUlid` char(26), IN `originParam` tinytext)
BEGIN
    DECLARE sessionUlid CHAR(26);

    -- Get user ID based on email and return a message if not found
    IF (SELECT COUNT(*) FROM users WHERE id = userUlid) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_NOTFOUND';
    ELSE
        -- Generate a ULID for the session token
        SET sessionUlid = ULID_FROM_DATETIME(NOW());

        -- Insert the session with current timestamp and expiry 24 hours from now
        INSERT INTO sessions (id, userid, created, expires, origin)
        VALUES (sessionUlid, userUlid, CURRENT_TIMESTAMP(), TIMESTAMPADD(HOUR, 24, CURRENT_TIMESTAMP()), originParam);

        SELECT sessionUlid AS result;
    END IF;
END;;

DROP PROCEDURE IF EXISTS `deleteDeveloper`;;
CREATE PROCEDURE `deleteDeveloper`(IN `developerUlidParam` char(26))
BEGIN
    -- Verify if the developer UUID exists
    IF (SELECT COUNT(*) FROM developers WHERE id = developerUlidParam) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'DEVELOPER_ULID_NOTFOUND';
    END IF;

    -- Remove members from developer_members
    DELETE FROM developers_members
    WHERE developerid = developerUlidParam;

    -- Delete the entry in developers
    DELETE FROM developers
    WHERE id = developerUlidParam;

    SELECT 'OK' AS result;
END;;

DROP PROCEDURE IF EXISTS `getGameInfo`;;
CREATE PROCEDURE `getGameInfo`(IN `ulidParam` char(26))
SELECT g.name AS game_name, d.name AS developer_name
FROM games g
JOIN developers d ON g.developerid = d.id
WHERE g.id = ulidParam
LIMIT 1;;

DROP PROCEDURE IF EXISTS `getUserPassword`;;
CREATE PROCEDURE `getUserPassword`(IN `userUlid` char(26))
BEGIN
    -- Check if the user exists
    IF (SELECT COUNT(*) FROM users WHERE id = userUlid) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_NOTFOUND';
    END IF;

    -- Return salted hash
    SELECT password AS result
    FROM users
    WHERE id = userUlid;
END;;

DROP PROCEDURE IF EXISTS `getUserULID`;;
CREATE PROCEDURE `getUserULID`(IN `usernameParam` tinytext)
BEGIN
    DECLARE userUlid CHAR(26);

    -- Get user UUID based on email
    SELECT id INTO userUlid
    FROM users
    WHERE username = usernameParam;

    -- If user is not found, return NULL
    IF userUlid IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_NOTFOUND';
    ELSE
        SELECT userUlid AS ULID;
    END IF;
END;;

DROP PROCEDURE IF EXISTS `removeAdmin`;;
CREATE PROCEDURE `removeAdmin`(IN `userUlid` char(26))
BEGIN

    -- Check if user exists
    IF (SELECT COUNT(*) FROM users WHERE id = userUlid) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_NOTFOUND';
    END IF;
 
    -- Check if the user is already an admin
    IF (SELECT COUNT(*) FROM admins WHERE userid = userUlid) = 0 THEN
       SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'USER_NOTADMIN';
    ELSE 
       DELETE FROM admins WHERE userid = userUlid;
       SELECT 'OK' AS result;
    END IF;
END;;

DROP PROCEDURE IF EXISTS `updateUserPassword`;;
CREATE PROCEDURE `updateUserPassword`(IN `userUlid` tinytext, IN `newPass` text)
BEGIN
    -- Check if the user exists
    IF (SELECT COUNT(*) FROM users WHERE id = userUlid) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'USER_NOTFOUND';
    END IF;

    -- Update salted hash
    UPDATE users
    SET password = newPass
    WHERE id = userUlid;

    -- Return OK
    SELECT 'OK' AS result;
END;;

DROP PROCEDURE IF EXISTS `verifySession`;;
CREATE PROCEDURE `verifySession`(IN `ulidToken` char(26))
SELECT (s.expires <= CURRENT_TIMESTAMP()) AS expired
FROM sessions s
WHERE s.id = ulidToken;;

DELIMITER ;

CREATE TABLE `admins` (
  `userid` char(26) NOT NULL COMMENT 'ULID',
  `state` bit(16) NOT NULL DEFAULT b'0',
  KEY `userid` (`userid`),
  CONSTRAINT `admins_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `developers` (
  `id` char(26) NOT NULL COMMENT 'ULID',
  `name` tinytext NOT NULL,
  `state` bit(16) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`name` is not null)
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `developers_members` (
  `developerid` char(26) NOT NULL COMMENT 'ULID',
  `userid` char(26) NOT NULL COMMENT 'ULID',
  KEY `developerid` (`developerid`),
  KEY `userid` (`userid`),
  CONSTRAINT `developers_members_ibfk_1` FOREIGN KEY (`developerid`) REFERENCES `developers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `developers_members_ibfk_2` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `games` (
  `id` char(26) NOT NULL COMMENT 'ULID',
  `developerid` char(26) NOT NULL COMMENT 'ULID',
  `name` tinytext NOT NULL,
  `state` bit(16) NOT NULL DEFAULT b'0',
  `created` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `developerid` (`developerid`),
  CONSTRAINT `games_ibfk_1` FOREIGN KEY (`developerid`) REFERENCES `developers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `games_authorized_origins` (
  `gameid` char(26) NOT NULL,
  `origin` tinytext NOT NULL,
  `state` bit(16) NOT NULL,
  KEY `gameid` (`gameid`),
  CONSTRAINT `games_authorized_origins_ibfk_1` FOREIGN KEY (`gameid`) REFERENCES `games` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `ip_blocklist` (
  `address` tinytext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `ip_whitelist` (
  `address` tinytext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `saves` (
  `userid` char(26) NOT NULL,
  `gameid` char(26) NOT NULL,
  `slotid` tinyint(3) unsigned NOT NULL,
  `contents` varchar(10000) NOT NULL,
  KEY `gameid` (`gameid`),
  KEY `userid` (`userid`),
  CONSTRAINT `saves_ibfk_1` FOREIGN KEY (`gameid`) REFERENCES `games` (`id`) ON DELETE CASCADE,
  CONSTRAINT `saves_ibfk_2` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `sessions` (
  `id` char(26) NOT NULL COMMENT 'ULID',
  `userid` char(26) NOT NULL COMMENT 'ULID',
  `created` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  `expires` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  `state` bit(16) NOT NULL DEFAULT b'0',
  `origin` tinytext NOT NULL COMMENT 'IP address',
  PRIMARY KEY (`id`),
  KEY `userid` (`userid`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


CREATE TABLE `users` (
  `id` char(26) NOT NULL COMMENT 'ULID',
  `username` tinytext NOT NULL COMMENT 'Used for login',
  `password` text NOT NULL COMMENT 'Scrypt Hash',
  `gamertag` tinytext NOT NULL COMMENT 'Changable',
  `email` tinytext NOT NULL COMMENT 'Required for alerts',
  `created` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp() COMMENT 'Keep track of account creation dates',
  `state` bit(16) NOT NULL DEFAULT b'0' COMMENT 'Various flags for the account',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`) USING HASH,
  UNIQUE KEY `email` (`email`) USING HASH
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;


-- 2024-01-30 17:53:15