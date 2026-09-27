const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function makeOrderNumber() {
  const d = new Date();
  const stamp = [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0')].join('');
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `STK-${stamp}-${suffix}`;
}

function clean(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function positiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 999999 ? n : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      try {
        await env.STK_METER_DB.prepare('SELECT 1 AS ok').first();
        return json({ ok: true, database: true });
      } catch (error) {
        return json({ ok: false, database: false, error: String(error?.message || error) }, 503);
      }
    }

    if (url.pathname === '/api/orders' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'Некорректный JSON.' }, 400);
      }

      const organization = clean(body.organization, 200);
      const inn = clean(body.inn, 12);
      const kpp = clean(body.kpp, 9);
      const contactName = clean(body.contactName, 150);
      const phone = clean(body.phone, 30);
      const email = clean(body.email, 200);
      const comment = clean(body.comment, 2000);
      const consentGiven = body.consentGiven === true;
      const consentVersion = clean(body.consentVersion, 50);
      const items = Array.isArray(body.items) ? body.items : [];

      if (!organization || !inn || !contactName || !phone || !email) {
        return json({ ok: false, error: 'Заполните обязательные поля заявки.' }, 400);
      }
      if (!/^\d{10,12}$/.test(inn)) {
        return json({ ok: false, error: 'ИНН указан в неверном формате.' }, 400);
      }
      if (kpp && !/^\d{9}$/.test(kpp)) {
        return json({ ok: false, error: 'КПП указан в неверном формате.' }, 400);
      }
      if (!consentGiven || !consentVersion) {
        return json({ ok: false, error: 'Необходимо дать согласие на обработку персональных данных.' }, 400);
      }
      if (!items.length || items.length > 200) {
        return json({ ok: false, error: 'Заявка должна содержать от 1 до 200 позиций.' }, 400);
      }

      const normalizedItems = [];
      let totalAmount = 0;
      for (const raw of items) {
        const productId = clean(String(raw.productId ?? ''), 100);
        const productName = clean(raw.productName, 500);
        const article = clean(raw.article, 200);
        const manufacturer = clean(raw.manufacturer, 200);
        const quantity = positiveInteger(raw.quantity);
        const price = raw.price === null || raw.price === '' || raw.price === undefined ? null : Number(raw.price);
        if (!productId || !productName || !quantity || (price !== null && (!Number.isFinite(price) || price < 0))) {
          return json({ ok: false, error: 'Одна из позиций заявки содержит некорректные данные.' }, 400);
        }
        const amount = price === null ? null : Math.round(price * quantity * 100) / 100;
        if (amount !== null) totalAmount += amount;
        normalizedItems.push({ productId, productName, article, manufacturer, quantity, price, amount });
      }

      totalAmount = Math.round(totalAmount * 100) / 100;
      const orderNumber = makeOrderNumber();
      const createdAt = new Date().toISOString();

      try {
        const orderResult = await env.STK_METER_DB.prepare(`
          INSERT INTO orders (
            order_number, created_at, organization, inn, kpp, contact_name,
            phone, email, comment, total_amount, consent_given, consent_version, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          orderNumber, createdAt, organization, inn, kpp || null, contactName,
          phone, email, comment || null, totalAmount || null, 1, consentVersion, 'new'
        ).run();

        const orderId = orderResult.meta.last_row_id;
        await env.STK_METER_DB.batch(
          normalizedItems.map((item) => env.STK_METER_DB.prepare(`
            INSERT INTO order_items (
              order_id, product_id, product_name, article, manufacturer, quantity, price, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            orderId, item.productId, item.productName, item.article || null,
            item.manufacturer || null, item.quantity, item.price, item.amount
          ))
        );

        return json({ ok: true, orderNumber });
      } catch (error) {
        console.error('Order creation failed', error);
        return json({ ok: false, error: 'Не удалось сохранить заявку. Попробуйте ещё раз.' }, 500);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
