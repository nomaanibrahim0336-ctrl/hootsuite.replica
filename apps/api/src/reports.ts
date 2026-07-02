// Report export — produces real CSV and PDF documents from live data.
import PDFDocument from 'pdfkit';
import { prisma, mapPost } from './prisma';

export interface ReportData {
  title: string;
  type: string;
  generatedAt: string;
  summary: { label: string; value: number }[];
  rows: { post: string; networks: string; status: string; likes: number; comments: number; shares: number; impressions: number }[];
}

export async function buildReportData(report: { name: string; type: string }): Promise<ReportData> {
  const posts = (await prisma.post.findMany({ orderBy: { createdAt: 'desc' } })).map(mapPost);

  let likes = 0, comments = 0, shares = 0, impressions = 0;
  const rows = posts.map((p) => {
    const e = p.engagements ?? { likes: 0, comments: 0, shares: 0, impressions: 0 };
    likes += e.likes || 0; comments += e.comments || 0; shares += e.shares || 0; impressions += e.impressions || 0;
    return {
      post: p.content.slice(0, 60),
      networks: p.networks.join(', '),
      status: p.status,
      likes: e.likes || 0, comments: e.comments || 0, shares: e.shares || 0, impressions: e.impressions || 0,
    };
  });

  return {
    title: report.name,
    type: report.type,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Total posts', value: posts.length },
      { label: 'Likes', value: likes },
      { label: 'Comments', value: comments },
      { label: 'Shares', value: shares },
      { label: 'Impressions', value: impressions },
    ],
    rows,
  };
}

export function toCsv(data: ReportData): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(`Report,${esc(data.title)}`);
  lines.push(`Type,${esc(data.type)}`);
  lines.push(`Generated,${esc(data.generatedAt)}`);
  lines.push('');
  lines.push(data.summary.map((s) => esc(s.label)).join(','));
  lines.push(data.summary.map((s) => esc(s.value)).join(','));
  lines.push('');
  lines.push(['Post', 'Networks', 'Status', 'Likes', 'Comments', 'Shares', 'Impressions'].join(','));
  for (const r of data.rows) {
    lines.push([r.post, r.networks, r.status, r.likes, r.comments, r.shares, r.impressions].map(esc).join(','));
  }
  return lines.join('\n');
}

export function toPdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#6c63ff').text('SocialHub', { continued: false });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor('#111').text(data.title);
    doc.fontSize(10).fillColor('#666').text(`${data.type} · generated ${new Date(data.generatedAt).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(13).fillColor('#111').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333');
    for (const s of data.summary) doc.text(`${s.label}: ${s.value.toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(13).fillColor('#111').text('Posts');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#333');
    for (const r of data.rows) {
      doc.text(`• [${r.status}] ${r.post}  —  ${r.networks}  (👍 ${r.likes} 💬 ${r.comments} 🔁 ${r.shares} 👁 ${r.impressions})`);
    }

    doc.end();
  });
}
