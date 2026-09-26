import { TestSubmission } from '../types';

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = (text || '').replace(/\r\n/g, '\n');
  const paragraphs = clean.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: string,
  strokeColor?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function downloadSubmissionAsImage(submission: TestSubmission): void {
  const scale = 2; // High-DPI Retina quality
  const width = 900;
  const padding = 40;
  const contentWidth = width - padding * 2;

  // Create measurement canvas
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) return;

  // Pre-calculate heights for all questions
  const questionBlocks = submission.evaluations.map((ev, idx) => {
    mCtx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    const qLines = wrapText(mCtx, `Q${idx + 1}. ${ev.questionText}`, contentWidth - 48);

    mCtx.font = '600 15px system-ui, -apple-system, sans-serif';
    const studentAnsText = ev.studentAnswerDisplay || '(No answer submitted)';
    const sLines = wrapText(mCtx, studentAnsText, contentWidth - 64);

    const correctAnsText = ev.correctAnswerDisplay || 'N/A';
    const cLines = wrapText(mCtx, correctAnsText, contentWidth - 64);

    let blockHeight = 52; // Header row inside question card
    blockHeight += qLines.length * 24 + 16; // Question text
    blockHeight += 32 + sLines.length * 22 + 16; // Student answer box
    blockHeight += 32 + cLines.length * 22 + 20; // Correct answer box

    return {
      ev,
      idx,
      qLines,
      sLines,
      cLines,
      blockHeight,
    };
  });

  const headerHeight = 260;
  const footerHeight = 70;
  const totalQuestionsHeight = questionBlocks.reduce((acc, b) => acc + b.blockHeight + 20, 0);
  const totalHeight = headerHeight + totalQuestionsHeight + footerHeight + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, totalHeight);

  let curY = padding;

  // Top Header Card
  drawRoundedRect(ctx, padding, curY, contentWidth, 230, 20, '#ffffff', '#e2e8f0', 1.5);

  // Brand tag
  ctx.fillStyle = '#4f46e5';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('OFFICIAL TEST RESULT REPORT', padding + 28, curY + 34);

  // Test Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  const titleText =
    submission.testTitle.length > 48
      ? submission.testTitle.slice(0, 45) + '...'
      : submission.testTitle;
  ctx.fillText(titleText, padding + 28, curY + 68);

  // Subject & Date
  ctx.fillStyle = '#64748b';
  ctx.font = '500 14px system-ui, -apple-system, sans-serif';
  const dateStr = new Date(submission.submittedAt).toLocaleString();
  ctx.fillText(`Subject: ${submission.subject || 'General'}  •  Submitted: ${dateStr}`, padding + 28, curY + 94);

  // Divider line
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding + 28, curY + 114);
  ctx.lineTo(padding + contentWidth - 28, curY + 114);
  ctx.stroke();

  // Student Info & Score Summary Row
  const isPass = submission.passed;
  const badgeBg = isPass ? '#ecfdf5' : '#fff1f2';
  const badgeBorder = isPass ? '#a7f3d0' : '#fecdd3';
  const badgeText = isPass ? '#047857' : '#be123c';

  // Student Box
  drawRoundedRect(ctx, padding + 28, curY + 130, 360, 76, 14, '#f8fafc', '#e2e8f0', 1);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('STUDENT NAME', padding + 44, curY + 152);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    submission.studentName + (submission.studentIdentifier ? ` (${submission.studentIdentifier})` : ''),
    padding + 44,
    curY + 180
  );

  // Score Box
  drawRoundedRect(ctx, padding + 408, curY + 130, contentWidth - 436, 76, 14, badgeBg, badgeBorder, 1.5);
  ctx.fillStyle = badgeText;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `FINAL MARKS & GRADE (${isPass ? 'PASSED' : 'NEEDS REVIEW'})`,
    padding + 426,
    curY + 152
  );
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${submission.totalScore} / ${submission.maxScore} Marks  (${submission.percentage}% • Grade ${submission.grade})`,
    padding + 426,
    curY + 184
  );

  curY += 254;

  // Render Each Question Block
  for (const block of questionBlocks) {
    const { ev, qLines, sLines, cLines, blockHeight } = block;
    const isCorrect = ev.status === 'correct';
    const isPartial = ev.status === 'partial';

    const cardBorder = isCorrect ? '#a7f3d0' : isPartial ? '#fde68a' : '#fecdd3';
    drawRoundedRect(ctx, padding, curY, contentWidth, blockHeight, 18, '#ffffff', cardBorder, 2);

    // Status pill inside question card
    const pillBg = isCorrect ? '#d1fae5' : isPartial ? '#fef3c7' : '#ffe4e6';
    const pillColor = isCorrect ? '#065f46' : isPartial ? '#92400e' : '#9f1239';
    const statusLabel = isCorrect ? '✓ CORRECT' : isPartial ? '◐ PARTIAL' : '✗ INCORRECT';

    drawRoundedRect(ctx, padding + 24, curY + 16, 120, 26, 8, pillBg);
    ctx.fillStyle = pillColor;
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(statusLabel, padding + 36, curY + 34);

    // Marks on right
    ctx.fillStyle = pillColor;
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    const marksLabel = `${ev.marksAwarded} / ${ev.maxMarks} Marks`;
    const marksW = ctx.measureText(marksLabel).width;
    ctx.fillText(marksLabel, padding + contentWidth - 24 - marksW, curY + 34);

    let innerY = curY + 66;

    // Question text lines
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    for (const line of qLines) {
      ctx.fillText(line, padding + 24, innerY);
      innerY += 24;
    }

    innerY += 8;

    // Student Answer Box (Green if right, Red if wrong)
    const sBoxH = 30 + sLines.length * 22;
    const sBoxBg = isCorrect ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fff1f2';
    const sBoxBorder = isCorrect ? '#6ee7b7' : isPartial ? '#fcd34d' : '#fda4af';
    const sTitleColor = isCorrect ? '#047857' : isPartial ? '#b45309' : '#be123c';

    drawRoundedRect(ctx, padding + 24, innerY, contentWidth - 48, sBoxH, 12, sBoxBg, sBoxBorder, 1.5);
    ctx.fillStyle = sTitleColor;
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      isCorrect ? 'STUDENT ANSWER (CORRECT):' : 'STUDENT ANSWER (INCORRECT):',
      padding + 38,
      innerY + 20
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    let sLineY = innerY + 42;
    for (const line of sLines) {
      ctx.fillText(line, padding + 38, sLineY);
      sLineY += 22;
    }

    innerY += sBoxH + 12;

    // Correct Answer Box beneath
    const cBoxH = 30 + cLines.length * 22;
    drawRoundedRect(ctx, padding + 24, innerY, contentWidth - 48, cBoxH, 12, '#f0fdf4', '#86efac', 1.5);
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('CORRECT ANSWER:', padding + 38, innerY + 20);

    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    let cLineY = innerY + 42;
    for (const line of cLines) {
      ctx.fillText(line, padding + 38, cLineY);
      cLineY += 22;
    }

    curY += blockHeight + 20;
  }

  // Footer
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Official Assessment Report • Candidate: ${submission.studentName} • Score: ${submission.totalScore}/${submission.maxScore} (${submission.percentage}%)`,
    padding,
    curY + 30
  );

  // Trigger PNG Download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const safeStudent = (submission.studentName || 'student')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const safeTitle = (submission.testTitle || 'test')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  link.download = `${safeStudent}-${safeTitle}-report.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
