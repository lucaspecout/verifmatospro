INSERT INTO users (username, password, name, role, must_change_password, last_login)
VALUES
  ('admin', 'admin', 'Administrateur', 'Admin', TRUE, NOW()),
  ('chef', 'chef', 'Chef de poste', 'Chef', FALSE, NOW()),
  ('marie', 'marie', 'Marie Dupont', 'Logistique', FALSE, NOW());

INSERT INTO postes (id, name, date, location, status, team)
VALUES
  ('ps-2024-01', 'Festival d''été', '2024-07-12', 'Parc municipal', 'En préparation', 8),
  ('ps-2024-02', 'Match régional', '2024-06-02', 'Stade nord', 'Prêt', 5);

INSERT INTO stock_items (name, expected, available, status)
VALUES
  ('Bandes élastiques', 120, 112, 'alert'),
  ('Compresses stériles', 200, 200, 'ok'),
  ('Masques O2', 40, 32, 'warn'),
  ('Gants nitrile', 300, 260, 'ok');
