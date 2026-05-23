import dotenv from 'dotenv';
dotenv.config();

export const EmailService = {
  /**
   * Envia un correo de confirmación de aprobación usando Mailjet API v3.1.
   * @param {string} toEmail - Correo del ciudadano
   * @param {string} toName - Nombre completo del ciudadano
   * @param {string} folio - Folio del trámite (ej. TRM-2026-00201)
   * @param {string} tramiteNombre - Nombre del trámite solicitado
   */
  sendApprovalEmail: async (toEmail, toName, folio, tramiteNombre) => {
    const apiKey = process.env.MAILJET_API_KEY;
    const apiSecret = process.env.MAILJET_API_SECRET;
    const fromEmail = process.env.MAILJET_FROM_EMAIL || 'no-reply@yucatan.gob.mx';
    const fromName = process.env.MAILJET_FROM_NAME || 'Gobierno del Estado de Yucatán';

    if (!apiKey || !apiSecret) {
      console.warn("⚠️ Advertencia Mailjet: Faltan las variables MAILJET_API_KEY o MAILJET_API_SECRET en el .env. Se omite el envío del correo.");
      return { success: false, message: 'Mailjet credentials missing' };
    }

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .header {
            background-color: #00382b;
            padding: 30px;
            text-align: center;
            border-bottom: 4px solid #D4AF37;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.5px;
          }
          .header p {
            color: #d1d5db;
            margin: 5px 0 0 0;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .content {
            padding: 40px 30px;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 20px;
          }
          .details-card {
            background-color: #f1f5f9;
            border-left: 4px solid #00382b;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .details-row {
            margin-bottom: 10px;
          }
          .details-row:last-child {
            margin-bottom: 0;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            color: #64748b;
            margin: 0;
          }
          .value {
            font-size: 14px;
            font-weight: 600;
            color: #334155;
            margin: 2px 0 0 0;
          }
          .badge {
            display: inline-block;
            background-color: #dcfce7;
            color: #15803d;
            font-size: 12px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 9999px;
            margin-top: 4px;
          }
          .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p>Gobierno del Estado de Yucatán</p>
            <h1>CIVICFLOW</h1>
          </div>
          <div class="content">
            <div class="title">Estimado(a) ${toName},</div>
            <p>Le informamos que su solicitud de trámite ha sido revisada, validada y <strong>APROBADA</strong> de manera satisfactoria por la dependencia correspondiente.</p>
            
            <div class="details-card">
              <div class="details-row">
                <p class="label">Folio de Trámite</p>
                <p class="value" style="font-family: monospace; font-size: 16px; color: #00382b; font-weight: bold;">${folio}</p>
              </div>
              <div class="details-row">
                <p class="label">Trámite</p>
                <p class="value">${tramiteNombre}</p>
              </div>
              <div class="details-row">
                <p class="label">Estado de la Solicitud</p>
                <div><span class="badge">Aprobado y Firmado</span></div>
              </div>
            </div>

            <p>Su documento digital con firma electrónica ha sido generado y se encuentra disponible para su consulta y descarga en su expediente digital personal.</p>
            <p>Agradecemos su participación en la modernización de los servicios del Estado de Yucatán.</p>
          </div>
          <div class="footer">
            Este es un correo automático. Por favor no responda a este mensaje.<br>
            © 2026 Gobierno del Estado de Yucatán. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: fromEmail,
                Name: fromName
              },
              To: [
                {
                  Email: toEmail,
                  Name: toName
                }
              ],
              Subject: `Trámite Aprobado - Folio ${folio}`,
              HTMLPart: htmlContent,
              TextPart: `Estimado(a) ${toName}, su trámite "${tramiteNombre}" con folio ${folio} ha sido aprobado.`
            }
          ]
        })
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("❌ Error al enviar correo mediante Mailjet API:", result);
        return { success: false, error: result };
      }

      console.log(`✉️ Correo enviado exitosamente a ${toEmail} para el folio ${folio}`);
      return { success: true, data: result };
    } catch (err) {
      console.error("❌ Excepción al enviar correo mediante Mailjet:", err);
      return { success: false, error: err.message };
    }
  }
};
