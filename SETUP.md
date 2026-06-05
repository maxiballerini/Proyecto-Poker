# Starter kit — arranque limpio para Claude Code

Pensado para que el proyecto arranque con el contexto liviano desde el segundo 0 y no quemes tokens al pedo.

## Qué hay acá
- **`CLAUDE.md`** — el archivo de mayor leverage. Se carga al inicio de CADA sesión. Lo dejé como esqueleto lean con las reglas de eficiencia ya puestas; lo completamos cuando armemos el prompt.
- **`.claude/settings.json`** — permisos pre-aprobados (para que no te pregunte por cada comando y no pierdas idas y vueltas) + statusLine + limpieza automática.
- **`.claude/statusline.sh`** — muestra modelo y carpeta en la barra de estado.
- **`.gitignore`** — evita commitear `node_modules`, `.env`, config personal de Claude, etc.
- **`docs/`** — documentación de referencia que **NO se carga al inicio**. Clave para no inflar el contexto.

## Cómo lo metés en el proyecto
Descomprimí el zip en la raíz del proyecto. Te queda:

```
tu-proyecto/
├── CLAUDE.md
├── .gitignore
├── SETUP.md            (este archivo; lo podés borrar después)
├── .claude/
│   ├── settings.json
│   └── statusline.sh
└── docs/
    ├── ARCHITECTURE.md
    └── DECISIONS.md
```

Después, una sola vez:
```bash
chmod +x .claude/statusline.sh
```

> Config personal tuya (que NO querés commitear) va en `.claude/settings.local.json` y en `CLAUDE.local.md`. Ya están en el `.gitignore`.

## Orden para instalar las herramientas (medí primero)
1. **Medí tu desperdicio actual.** Abrí una sesión fresca y corré `/context`. Si ya estás en 20%+ sin escribir nada, hay fuga al arranque.
2. **claude-token-optimizer** — reestructura la documentación para que Claude cargue solo lo necesario. Trae un comando `measure` para ver el antes/después.
3. **ccusage** — monitor de consumo desde tus archivos JSONL locales, offline, sin tocar la API.
4. *(opcional)* **claude-token-lens** — te dice qué MCP / skill / agente te está quemando la cuota. Útil para revisar si Stitch o Nano Banana te comen contexto al pedo.

## Reglas de oro (tokens)
- **CLAUDE.md corto.** Solo lo que sorprendería a un dev nuevo. Lo genérico Claude ya lo sabe.
- **Comentarios HTML** `<!-- ... -->` en CLAUDE.md = 0 tokens. Usalos para notas tuyas.
- **No metas todos los MCP/skills "por las dudas":** cada uno suma al arranque de cada sesión.
- **Salida ruidosa** (installs, tests, builds) → a un log, y leé solo el `tail`.
- **Una sesión = una tarea.** Cuando terminás algo, `/clear` antes de la próxima para no arrastrar contexto viejo.
