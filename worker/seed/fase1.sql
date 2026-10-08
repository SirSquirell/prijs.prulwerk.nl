-- Eerste testproduct, zodat er vanaf de eerste deploy data binnenkomt.
-- Eenmalig: npx wrangler d1 execute prijswacht --remote --file seed/fase1.sql
INSERT INTO products (id, name, created_at) VALUES (1, 'Sony WH-1000XM6 zwart', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
INSERT INTO offers (product_id, shop, url, created_at) VALUES
  (1, 'coolblue', 'https://www.coolblue.nl/product/962722/sony-wh-1000xm6-zwart.html', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  (1, 'bol', 'https://www.bol.com/nl/nl/p/sony-wh-1000xm6-draadloze-koptelefoon-met-noise-cancelling-zwart/9300000229857581/', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  (1, 'amazon', 'https://www.amazon.nl/dp/B0F2TT8Q7M', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
