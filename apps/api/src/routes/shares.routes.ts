/**
 * Public Share Routes
 *
 * Unauthenticated endpoint behind the /s/<token> links sent over WhatsApp.
 * Redirects to a short-lived signed download URL for the shared invoice PDF;
 * expired or unknown tokens get a small human-readable page, since this is
 * opened by the recipient's browser, not by the app.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { resolveInvoiceShare } from '../services/invoice-share.service';
import { rateLimiter } from '../middleware/rate-limit';

const router: Router = Router();

const shareRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});

function messagePage(title: string, body: string): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center">
<h1 style="font-size:1.25rem">${title}</h1><p style="color:#555">${body}</p></body></html>`;
}

/**
 * GET /public/shares/:token
 * Redirect to the shared invoice PDF
 */
router.get(
  '/:token',
  shareRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await resolveInvoiceShare(req.params.token);
      res.setHeader('Cache-Control', 'no-store');

      if (result.status === 'ok') {
        res.redirect(302, result.url);
        return;
      }

      const expired = result.status === 'expired';
      res
        .status(expired ? 410 : 404)
        .type('html')
        .send(
          expired
            ? messagePage(
                'انتهت صلاحية الرابط · Link expired',
                'يرجى طلب نسخة جديدة من الفاتورة. · Please ask for a new copy of the invoice.'
              )
            : messagePage(
                'الرابط غير صالح · Link not found',
                'تأكد من الرابط أو اطلب نسخة جديدة. · Check the link or ask for a new copy.'
              )
        );
    } catch (error) {
      next(error);
    }
  }
);

export default router;
