#!/usr/bin/env python3
"""Preview only: read Marcin's CSV and write a local, private JSON. No network or DB writes."""
import argparse,csv,datetime,hashlib,io,json,pathlib,re,collections,os

def date(value):
    value=value.strip()
    if not re.fullmatch(r'\d{1,2}[.\-]\d{1,2}[.\-]\d{4}',value):return ''
    try:return datetime.datetime.strptime(re.sub(r'[.\-]','.',value),'%d.%m.%Y').date().isoformat()
    except ValueError:return ''

def preview(source):
    raw=source.read_bytes();rows=list(csv.reader(io.StringIO(raw.replace(b'\r\n',b'\n').decode('utf-8-sig')),delimiter=';'))
    result=[];warnings=collections.Counter();seen=set()
    for n,row in enumerate(rows[1:],2):
        if not row or not date(row[0]):continue
        if len(row)!=21:raise ValueError(f'Wiersz {n}: oczekiwano 21 kolumn.')
        r=[x.strip() for x in row];lead=re.sub(r'\s+','',r[1]);id='history-'+lead
        if not lead or id in seen:raise ValueError(f'Wiersz {n}: puste lub powtórzone ID.')
        seen.add(id);issues=[]
        time=r[2].zfill(5) if re.fullmatch(r'(?:[01]?\d|2[0-3]):[0-5]\d',r[2]) else ''
        if not time:issues.append('invalid_first_time')
        if '-' in r[0] and '.' in r[0]:issues.append('mixed_date_separators')
        quality=r[5] if r[5] in 'ABCD' and len(r[5])==1 else ''
        stage={'NOWY':'Nowy','ZAMKNIETY WYGRANY':'Wygrany','ZAMKNIETY PRZEGRANY':'Przegrany'}.get(r[8],'W kontakcie' if r[8] else 'Nowy')
        closed=date(r[13]);amount=None
        if r[14]:
            try:
                value=float(re.sub(r'\s|zł|PLN','',r[14]).replace(',','.'))
                if value<0 or value>10000000:raise ValueError()
                amount=value
            except ValueError:issues.append('unparsed_amount')
        if stage=='Wygrany' and not closed:issues.append('won_without_close_date')
        if r[11]:issues.append('historical_duration_not_converted')
        if r[16]:issues.append('historical_followup_needs_confirmation')
        category={'Indywidulane':'Terapia indywidualna','<18 lat':'Poniżej 18 lat','Inne forma terapi':'Inna forma terapii'}.get(r[4],r[4])
        source_name={'MAIL':'Mail','POLECENIE':'Polecenie','FB':'Facebook','OFERTEO':'Oferteo'}.get(r[7],r[7])
        status={'BRAK DECYZJI':'Brak decyzji','FOLLOW UP':'Follow-up','ODPADA':'Odpada','ZADATEK':'Zadatek','REZERWACJA':'Rezerwacja','NIEAKTULANE':'Nieaktualne','BRAK KONTAKTU':'Brak kontaktu'}.get(r[12],r[12])
        c=dict(id=id,label=r[1],phone=r[17],firstDate=date(r[0]),firstTime=time,category=category,quality=quality,temperature=r[6],source=source_name,stage=stage,province=r[10],status=status,closedDate=closed,lossReason=r[15],nextDate='',nextTime='',followupStatus=r[18],note=r[19],followupNote=r[20],owner='',revision=0,historical=True,followupConfirmed=False,historicalCount=r[9],historicalDuration=r[11])
        result.append({'contact':c,'financial':{'amount':amount},'sourceRow':n,'source':dict(zip(rows[0],row)),'warnings':issues})
        warnings.update(issues)
    dates=[x['contact']['firstDate'] for x in result]
    return {'summary':{'records':len(result),'callsToCreate':0,'firstDate':min(dates) if dates else None,'lastDate':max(dates) if dates else None,'warnings':dict(warnings),'sha256':hashlib.sha256(raw).hexdigest(),'sha256LF':hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest(),'productionWrites':0},'records':result}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=pathlib.Path);parser.add_argument('--output',type=pathlib.Path,required=True);args=parser.parse_args()
    data=preview(args.source)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f:json.dump(data,f,ensure_ascii=False,indent=2)
    args.output.chmod(0o600)
    print(json.dumps(data['summary'],ensure_ascii=False,indent=2))
