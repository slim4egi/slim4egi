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
  const stamp = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('');

  const suffix = crypto.randomUUID()
    .replace(/-/g, '')
    .slice(0, 6)
    .toUpperCase();

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value)) + ' ₽';
}

function buildOrderEmail({
  orderNumber,
  createdAt,
  organization,
  inn,
  kpp,
  contactName,
  phone,
  email,
  comment,
  normalizedItems,
  totalAmount,
}) {
  const itemsHtml = normalizedItems.map((item) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">
        ${escapeHtml(item.productName)}
      </td>
      <td style="padding:8px;border:1px solid #ddd;">
        ${escapeHtml(item.article || '—')}
      </td>
      <td style="padding:8px;border:1px solid #ddd;">
        ${escapeHtml(item.manufacturer || '—')}
      </td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">
        ${item.quantity}
      </td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;">
        ${formatMoney(item.price)}
      </td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;">
        ${formatMoney(item.amount)}
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
      <h2>Новая заявка ${escapeHtml(orderNumber)}</h2>

      <p>
        <strong>Дата:</strong>
        ${escapeHtml(createdAt)}
      </p>

      <h3>Заказчик</h3>

      <table style="border-collapse:collapse;width:100%;max-width:700px;">
        <tr>
          <td style="padding:6px;border:1px solid #ddd;"><strong>Организация</strong></td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(organization)}</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ddd;"><strong>ИНН</strong></td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(inn)}</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ddd;"><strong>КПП</strong></td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(kpp || '—')}</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ddd;"><strong>Контактное лицо</strong></td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(contactName)}</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ddd;"><strong>Телефон</strong></td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(phone)}</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ddd;"><strong>E-mail</strong></td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(email)}</td>
        </tr>
      </table>

      <h3>Состав заявки</h3>

      <table style="border-collapse:collapse;width:100%;max-width:1000px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Товар</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Артикул</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Производитель</th>
            <th style="padding:8px;border:1px solid #ddd;">Кол-во</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Цена</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p style="font-size:18px;">
        <strong>Итого: ${formatMoney(totalAmount)}</strong>
      </p>

      ${comment ? `
        <h3>Комментарий</h3>
        <p>${escapeHtml(comment).replace(/\n/g, '<br>')}</p>
      ` : ''}

      <hr>

      <p style="color:#666;font-size:12px;">
        Заявка сформирована на сайте ООО «СТК Метер».
      </p>
    </div>
  `;
}

async function sendOrderEmail(env, data) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    console.warn('Resend is not configured');
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `order-${data.orderNumber}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: ['delivered@resend.dev'],
      reply_to: data.email,
      subject: `ТЕСТ — новая заявка ${data.orderNumber} — ${data.organization}`,
      html: buildOrderEmail(data),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend email failed', response.status, errorText);
    return false;
  }

  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      try {
        await env.STK_METER_DB.prepare('SELECT 1 AS ok').first();
        return json({ ok: true, database: true });
      } catch (error) {
        return json({
          ok: false,
          database: false,
          error: String(error?.message || error),
        }, 503);
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
        return json({
          ok: false,
          error: 'Заполните обязательные поля заявки.',
        }, 400);
      }

      if (!/^\d{10,12}$/.test(inn)) {
        return json({
          ok: false,
          error: 'ИНН указан в неверном формате.',
        }, 400);
      }

      if (kpp && !/^\d{9}$/.test(kpp)) {
        return json({
          ok: false,
          error: 'КПП указан в неверном формате.',
        }, 400);
      }

      if (!consentGiven || !consentVersion) {
        return json({
          ok: false,
          error: 'Необходимо дать согласие на обработку персональных данных.',
        }, 400);
      }

      if (!items.length || items.length > 200) {
        return json({
          ok: false,
          error: 'Заявка должна содержать от 1 до 200 позиций.',
        }, 400);
      }

      const normalizedItems = [];
      let totalAmount = 0;

      for (const raw of items) {
        const productId = clean(String(raw.productId ?? ''), 100);
        const productName = clean(raw.productName, 500);
        const article = clean(raw.article, 200);
        const manufacturer = clean(raw.manufacturer, 200);
        const quantity = positiveInteger(raw.quantity);

        const price =
          raw.price === null ||
          raw.price === '' ||
          raw.price === undefined
            ? null
            : Number(raw.price);

        if (
          !productId ||
          !productName ||
          !quantity ||
          (price !== null &&
            (!Number.isFinite(price) || price < 0))
        ) {
          return json({
            ok: false,
            error: 'Одна из позиций заявки содержит некорректные данные.',
          }, 400);
        }

        const amount =
          price === null
            ? null
            : Math.round(price * quantity * 100) / 100;

        if (amount !== null) {
          totalAmount += amount;
        }

        normalizedItems.push({
          productId,
          productName,
          article,
          manufacturer,
          quantity,
          price,
          amount,
        });
      }

      totalAmount = Math.round(totalAmount * 100) / 100;

      const orderNumber = makeOrderNumber();
      const createdAt = new Date().toISOString();

      try {
        const orderResult = await env.STK_METER_DB.prepare(`
          INSERT INTO orders (
            order_number,
            created_at,
            organization,
            inn,
            kpp,
            contact_name,
            phone,
            email,
            comment,
            total_amount,
            consent_given,
            consent_version,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          orderNumber,
          createdAt,
          organization,
          inn,
          kpp || null,
          contactName,
          phone,
          email,
          comment || null,
          totalAmount || null,
          1,
          consentVersion,
          'new'
        ).run();

        const orderId = orderResult.meta.last_row_id;

        await env.STK_METER_DB.batch(
          normalizedItems.map((item) =>
            env.STK_METER_DB.prepare(`
              INSERT INTO order_items (
                order_id,
                product_id,
                product_name,
                article,
                manufacturer,
                quantity,
                price,
                amount
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              orderId,
              item.productId,
              item.productName,
              item.article || null,
              item.manufacturer || null,
              item.quantity,
              item.price,
              item.amount
            )
          )
        );

        const emailSent = await sendOrderEmail(env, {
          orderNumber,
          createdAt,
          organization,
          inn,
          kpp,
          contactName,
          phone,
          email,
          comment,
          normalizedItems,
          totalAmount,
        });

        return json({
          ok: true,
          orderNumber,
          emailSent,
        });

      } catch (error) {
        console.error('Order creation failed', error);

        return json({
          ok: false,
          error: 'Не удалось сохранить заявку. Попробуйте ещё раз.',
        }, 500);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
