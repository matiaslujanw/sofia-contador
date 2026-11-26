import {test,expect} from '@playwright/test';
test('abre la ficha individual del proveedor y filtra la cartera por tipo',async({page})=>{
 await page.goto('/contabilidad?empresa=10000000-0000-4000-8000-000000000010');
 await page.getByRole('button',{name:'Proveedores',exact:true}).click();
 await page.getByRole('button',{name:'Equipamientos Norte',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Cuenta corriente · Equipamientos Norte'});
 await expect(d).toContainText('580.800,00');await expect(d).toContainText('Factura A');
 await d.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Clientes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Equipamientos Norte',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Todos',exact:true}).click();
 await expect(page.getByRole('button',{name:'Equipamientos Norte',exact:true})).toBeVisible();
});
