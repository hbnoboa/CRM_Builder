/** E-mail transacional simples (botao + link em texto), sem dependencias de template. */
export function transactionalEmail(input: {
  title: string;
  paragraphs: string[];
  buttonLabel: string;
  url: string;
  footer: string;
}): { html: string; text: string } {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px">${esc(input.title)}</h1>
${input.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(p)}</p>`).join('')}
<p style="margin:24px 0"><a href="${esc(input.url)}" style="background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${esc(input.buttonLabel)}</a></p>
<p style="margin:0 0 4px;font-size:12px;color:#71717a">Se o botão não funcionar, copie este endereço no navegador:</p>
<p style="margin:0 0 20px;font-size:12px;word-break:break-all"><a href="${esc(input.url)}" style="color:#52525b">${esc(input.url)}</a></p>
<p style="margin:0;font-size:12px;color:#a1a1aa">${esc(input.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [input.title, '', ...input.paragraphs, '', `${input.buttonLabel}: ${input.url}`, '', input.footer].join('\n');
  return { html, text };
}
