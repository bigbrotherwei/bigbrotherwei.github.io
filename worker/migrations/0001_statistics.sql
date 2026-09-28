CREATE TABLE site_totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pv INTEGER NOT NULL DEFAULT 0 CHECK (pv >= 0),
  uv INTEGER NOT NULL DEFAULT 0 CHECK (uv >= 0)
);

INSERT INTO site_totals (id) VALUES (1);

CREATE TABLE article_views (
  path TEXT PRIMARY KEY,
  pv INTEGER NOT NULL DEFAULT 0 CHECK (pv >= 0)
);

CREATE TABLE visitors (
  visitor_hash TEXT PRIMARY KEY
);

CREATE TABLE recent_visits (
  visitor_hash TEXT NOT NULL,
  path TEXT NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (visitor_hash, path),
  FOREIGN KEY (visitor_hash) REFERENCES visitors(visitor_hash)
);

CREATE TABLE presence (
  visitor_hash TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);

CREATE INDEX presence_last_seen_idx ON presence(last_seen);

CREATE TRIGGER visitors_after_insert AFTER INSERT ON visitors
BEGIN
  UPDATE site_totals SET uv = uv + 1 WHERE id = 1;
END;

CREATE TRIGGER recent_visits_after_insert AFTER INSERT ON recent_visits
BEGIN
  UPDATE site_totals SET pv = pv + 1 WHERE id = 1;
  INSERT INTO article_views (path, pv)
    SELECT NEW.path, 1 WHERE NEW.path GLOB '/posts/*/'
    ON CONFLICT (path) DO UPDATE SET pv = pv + 1;
END;

CREATE TRIGGER recent_visits_after_update AFTER UPDATE OF last_at ON recent_visits
WHEN NEW.last_at >= OLD.last_at + 5
BEGIN
  UPDATE site_totals SET pv = pv + 1 WHERE id = 1;
  INSERT INTO article_views (path, pv)
    SELECT NEW.path, 1 WHERE NEW.path GLOB '/posts/*/'
    ON CONFLICT (path) DO UPDATE SET pv = pv + 1;
END;
