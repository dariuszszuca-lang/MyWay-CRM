import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableDocuments, genderFromPesel, formatDateLongPl, buildDocumentData, documentFileName,
} from '../services/dischargeDocuments.ts';

const base = {
  firstName: 'Anna', lastName: 'Kowalska-Żółć', pesel: '90010112344', package: '3',
  treatmentStartDate: '2026-06-15', treatmentEndDate: '2026-07-13', status: 'discharged',
  dischargeType: 'completed', dischargeDate: '2026-07-13',
};

test('dyplom i zaświadczenie o ukończeniu tylko przy zakończonej terapii', () => {
  assert.deepEqual(availableDocuments(base), ['dyplom', 'ukonczenie', 'pobyt', 'uczestnictwo']);
  assert.deepEqual(availableDocuments({ ...base, dischargeType: 'resignation' }), ['pobyt', 'uczestnictwo']);
  assert.deepEqual(availableDocuments({ ...base, status: 'active', dischargeType: undefined }), ['pobyt', 'uczestnictwo']);
});

test('płeć z PESEL: 10. cyfra parzysta = kobieta, nieparzysta = mężczyzna, zły PESEL = brak', () => {
  assert.equal(genderFromPesel('90010112344'), 'f'); // 4 parzysta
  assert.equal(genderFromPesel('85042967215'), 'm'); // 1 nieparzysta
  assert.equal(genderFromPesel('123'), null);
  assert.equal(genderFromPesel(''), null);
});

test('data długa po polsku', () => {
  assert.equal(formatDateLongPl('2026-08-21'), '21 sierpnia 2026');
  assert.equal(formatDateLongPl('2026-01-05'), '5 stycznia 2026');
});

test('dane dokumentu wypisanej pacjentki: odmiana żeńska, pobyt do daty wypisu', () => {
  const d = buildDocumentData(base, '2026-08-21');
  assert.equal(d.fullName, 'Anna Kowalska-Żółć');
  assert.equal(d.salutation, 'Pani');
  assert.equal(d.verbs.stayed, 'przebywała');
  assert.equal(d.verbs.completed, 'ukończyła');
  assert.equal(d.stayFrom, '15 czerwca 2026');
  assert.equal(d.stayTo, '13 lipca 2026');
  assert.equal(d.inProgress, false);
  assert.equal(d.packageName, 'Pakiet 3');
  assert.equal(d.issuedOn, '21 sierpnia 2026');
});

test('dane dokumentu aktywnego pacjenta: pobyt do dziś, terapia w toku, brak płci = forma podwójna', () => {
  const d = buildDocumentData({ ...base, pesel: 'brak', status: 'active', dischargeType: undefined, dischargeDate: undefined }, '2026-08-21');
  assert.equal(d.stayTo, '21 sierpnia 2026');
  assert.equal(d.inProgress, true);
  assert.equal(d.plannedEnd, '13 lipca 2026');
  assert.equal(d.salutation, 'Pan/Pani');
  assert.equal(d.verbs.stayed, 'przebywa');
  assert.equal(d.verbs.participated, 'uczestniczy');
});

test('wypisany pacjent bez poprawnego PESEL dostaje formę podwójną w czasie przeszłym', () => {
  const d = buildDocumentData({ ...base, pesel: 'brak' }, '2026-08-21');
  assert.equal(d.verbs.stayed, 'przebywał(a)');
  assert.equal(d.verbs.completed, 'ukończył(a)');
});

test('nazwa pliku bez polskich znaków i spacji', () => {
  assert.equal(documentFileName('pobyt', base), 'zaswiadczenie-o-pobycie-anna-kowalska-zolc.pdf');
  assert.equal(documentFileName('dyplom', base), 'dyplom-anna-kowalska-zolc.pdf');
});
