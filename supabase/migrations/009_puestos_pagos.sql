-- Cantidad de puestos pagos del torneo (opcional)
alter table tournament_entry
  add column puestos_pagos integer check (puestos_pagos is null or puestos_pagos > 0);
