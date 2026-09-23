import json,re
from pathlib import Path
root=Path.cwd()
u=root/'ui/app/app/utils'
texts=json.loads((u/'questionnaire-core.json').read_text())|json.loads((u/'questionnaire-specific.json').read_text())
kinds=dict(re.findall(r"id: '([^']+)', kind: '([^']+)'",(u/'questionnaire.ts').read_text()))
schema={key:dict(value,kind=kinds[key]) for key,value in texts.items() if key in kinds}
(root/'api/app/core/analysis_schema.json').write_text(json.dumps(schema,indent=2,ensure_ascii=False)+'\n')
