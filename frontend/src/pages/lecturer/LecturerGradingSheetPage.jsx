import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, message } from 'antd';
import evaluationService from '../../services/evaluationService';
import PageLoader from '../../components/common/PageLoader';
import templateHtmlRaw from './phieu_cham.html?raw';

const ROLE_LABELS = { CHAIRMAN: 'Chu tich', SECRETARY: 'Thu ky', REVIEWER: 'Uy vien' };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const RUBRIC_CODES = [
  'STRUCTURE','CITATION_FORMAT','LANGUAGE','PROBLEM_STATEMENT','RESEARCH_METHOD','RESEARCH_CONTENT','RESEARCH_RESULT',
  'NOVELTY','APPLICABILITY','PUBLICATION','PRESENTATION_SKILL','ATTITUDE','PRESENTATION_CONTENT','QA_RESPONSE',
];

const MAX_MAP = {
  STRUCTURE: 0.5, CITATION_FORMAT: 0.25, LANGUAGE: 0.25, PROBLEM_STATEMENT: 1.0, RESEARCH_METHOD: 0.5,
  RESEARCH_CONTENT: 2.5, RESEARCH_RESULT: 1.0, NOVELTY: 0.25, APPLICABILITY: 0.5, PUBLICATION: 0.25,
  PRESENTATION_SKILL: 0.5, ATTITUDE: 0.5, PRESENTATION_CONTENT: 1.0, QA_RESPONSE: 1.0,
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default function LecturerGradingSheetPage() {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scoreLocked, setScoreLocked] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [currentEvaluator, setCurrentEvaluator] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    window.__updateScoreCell = (criterionCode, value) => {
      setRows((prev) => prev.map((r) => (r.criterionCode === criterionCode ? { ...r, score: value === '' ? null : Number(value) } : r)));
    };
    return () => {
      delete window.__updateScoreCell;
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await evaluationService.getScoreSheet(registrationId);
        if (!res.success) return;
        const payload = res.data || {};
        const scoreMap = new Map((payload.scores || []).map((s) => [s.criterionCode, s]));
        const mapped = RUBRIC_CODES.map((code) => ({
          criterionCode: code,
          score: Number.isFinite(Number(scoreMap.get(code)?.score)) ? Number(scoreMap.get(code).score) : null,
        }));
        setRows(mapped);
        setRegistration(payload.registration || null);
        setCurrentEvaluator(payload.currentEvaluator || null);
        setScoreLocked(Boolean(payload.scoreLocked));
      } catch (e) {
        message.error(e.message || 'Khong the tai phieu cham');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [registrationId]);

  const totalScore = useMemo(() => round2(rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0)), [rows]);

  const renderedHtml = useMemo(() => {
    if (!registration) return templateHtmlRaw;
    let html = templateHtmlRaw;

    const tokenMap = {
      EVALUATOR_NAME: currentEvaluator?.fullName || '',
      COUNCIL_ROLE: ROLE_LABELS[currentEvaluator?.roleInCouncil] || currentEvaluator?.roleInCouncil || '',
      STUDENT_NAME: registration?.student?.fullName || '',
      STUDENT_CODE: registration?.student?.code || '',
      STUDENT_CLASS: registration?.student?.className || registration?.student?.class || '',
      STUDENT_COHORT: registration?.student?.course || registration?.student?.cohort || '',
      STUDENT_DEPARTMENT: registration?.student?.department || '',
      TOPIC_TITLE: registration?.topic?.title || '',
    };
    Object.entries(tokenMap).forEach(([key, value]) => {
      html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
    });

    let idx = 0;
    html = html.replace(/<td><\/td>/g, () => {
      const code = RUBRIC_CODES[idx] || '';
      const score = rows[idx]?.score ?? '';
      const max = MAX_MAP[code] ?? 10;
      idx += 1;
      return `<td><input type="number" step="0.05" min="0" max="${max}" value="${score}" ${scoreLocked ? 'disabled' : ''} style="width:100%;border:1px solid #666;padding:2px 4px;font-family:'Times New Roman',Times,serif;font-size:10pt;" oninput="window.__updateScoreCell && window.__updateScoreCell('${code}', this.value)" /></td>`;
    });

    html = html.replace(/(<strong>Tá»•ng sá»‘ Ä‘iá»ƒm<\/strong><\/td>\s*<td class="text-center"><strong>10\.0<\/strong><\/td>\s*<td colspan="5"><\/td>\s*<td>)(<\/td>)/, `$1<strong>${totalScore}</strong>$2`);
    return html;
  }, [registration, currentEvaluator, rows, scoreLocked, totalScore]);

  const save = async () => {
    if (rows.some((r) => r.score === null || r.score === undefined || Number.isNaN(Number(r.score)))) {
      message.warning('Vui long nhap day du diem cho tat ca tieu chi');
      return;
    }
    try {
      setSaving(true);
      const payload = { scores: rows.map((r) => ({ criterionCode: r.criterionCode, score: Number(r.score) })) };
      const res = await evaluationService.saveScoreSheet(registrationId, payload);
      if (res.success) message.success('Da luu phieu cham');
    } catch (e) {
      message.error(e.message || 'Khong the luu phieu cham');
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    try {
      setExporting(true);
      const res = await evaluationService.exportScoreSheetPdf(registrationId);
      if (res.success) {
        message.success('Da xuat PDF');
        if (res.data?.pdfUrl) window.open(res.data.pdfUrl, '_blank');
      }
    } catch (e) {
      message.error(e.message || 'Khong the xuat PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 bg-slate-100 min-h-screen">
      <div className="max-w-[1100px] mx-auto mb-3 flex justify-end gap-2">
        <Button onClick={() => navigate('/lecturer/grading')}>Quay lai</Button>
        <Button type="primary" onClick={save} loading={saving} disabled={scoreLocked}>Luu phieu</Button>
        <Button onClick={exportPdf} loading={exporting}>Xuat PDF</Button>
      </div>
      <div className="max-w-[1100px] mx-auto bg-white" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
}
