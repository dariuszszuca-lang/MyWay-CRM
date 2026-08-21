import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDischargeUpdatePayload } from '../services/dischargeUpdate.ts';

test('przerwa warunkowa zapisuje datę powrotu i czyści pola zwrotu', () => {
  const payload = buildDischargeUpdatePayload({ dischargeType: 'conditional_break', dischargeDate: '2026-08-19', conditionalReturnDate: '2026-09-01' });
  assert.equal(payload.dischargeType, 'conditional_break');
  assert.equal(payload.dischargeDate, '2026-08-19');
  assert.equal(payload.conditionalReturnDate, '2026-09-01');
  assert.equal(payload.refundAmount, null);
  assert.equal(payload.refundDate, null);
});

test('zmiana powodu na zakończenie terapii czyści datę powrotu i zwrot', () => {
  const payload = buildDischargeUpdatePayload({ dischargeType: 'completed', dischargeDate: '2026-08-20', conditionalReturnDate: '2026-09-01', refundAmount: 500 });
  assert.equal(payload.conditionalReturnDate, null);
  assert.equal(payload.refundAmount, null);
  assert.equal(payload.refundDate, null);
});

test('rezygnacja ze zwrotem bez daty zwrotu bierze datę wypisu', () => {
  const payload = buildDischargeUpdatePayload({ dischargeType: 'resignation', dischargeDate: '2026-08-20', refundAmount: 500 });
  assert.equal(payload.refundAmount, 500);
  assert.equal(payload.refundDate, '2026-08-20');
});

test('uwagi są przycinane, puste uwagi zapisują null', () => {
  assert.equal(buildDischargeUpdatePayload({ dischargeType: 'expelled', dischargeDate: '2026-08-20', dischargeNotes: '  awantura  ' }).dischargeNotes, 'awantura');
  assert.equal(buildDischargeUpdatePayload({ dischargeType: 'completed', dischargeDate: '2026-08-20', dischargeNotes: '   ' }).dischargeNotes, null);
});

test('zapis zmian nie dotyka statusu pacjenta ani autoryzacji wypisu z długiem', () => {
  const payload = buildDischargeUpdatePayload({ dischargeType: 'completed', dischargeDate: '2026-08-20', authorizedBy: 'Natalia', authorizedNote: 'raty' });
  assert.equal('status' in payload, false);
  assert.equal('dischargeAuthorizedBy' in payload, false);
  assert.equal('dischargeAuthorizedNote' in payload, false);
});
