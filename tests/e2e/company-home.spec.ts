import {expect,test} from '@playwright/test';
const nexo='10000000-0000-4000-8000-000000000010',lumen='10000000-0000-4000-8000-000000000011';

test('el inicio muestra empresas y cada empresa abre sus herramientas con el alcance correcto',async({page})=>{
 await page.goto('/inicio');
 const main=page.getByRole('main');
 await expect(main.getByRole('heading',{level:1,name:'Contabilidad - Sofía Luján Contadora Pública',exact:true})).toBeVisible();
 await expect(main.getByRole('region',{name:'Cómo trabajar cada mes'})).toBeVisible();
 await expect(main.getByRole('heading',{name:'Empresas',exact:true})).toBeVisible();
 await expect(main.locator('.company-picker-card')).toHaveCount(3);
 await expect(page.getByRole('combobox',{name:'Período',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Compras y ventas',exact:true})).toHaveCount(0);
 await expect(main.getByRole('heading',{name:/Requiere atención|Próximos vencimientos|Resumen del estudio/})).toHaveCount(0);
 await main.getByRole('link').filter({hasText:'Nexo Custodia'}).click();
 await expect(page).toHaveURL(new RegExp(`empresa=${nexo}`));
 await expect(main.getByRole('heading',{name:'Nexo Custodia',exact:true})).toBeVisible();
 await expect(main.getByRole('link').filter({hasText:'Conciliación bancaria'})).toBeVisible();
 await main.getByRole('link').filter({hasText:'Caja y bancos'}).click();
 await expect(page).toHaveURL(/tipo=cash/);
 await expect(page.getByRole('button',{name:'Caja y bancos',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('combobox',{name:'Empresa',exact:true}).selectOption(lumen);
 await expect(page).toHaveURL(new RegExp(`empresa=${lumen}`));
 await expect(page.getByRole('heading',{name:'Cobros, pagos y otros movimientos'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Caja y bancos',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('link',{name:'← Todas las empresas',exact:true}).click();
 await expect(main.getByRole('heading',{name:'Empresas',exact:true})).toBeVisible();
 await expect(main.locator('.company-picker-card')).toHaveCount(3);
});

test('las empresas y sus accesos se pueden usar en iPad y teléfono',async({page})=>{
 for(const width of [820,390]){
  await page.setViewportSize({width,height:1180});await page.goto('/inicio');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('main').getByRole('link').filter({hasText:'Nexo Custodia'}).click();
  await expect(page.getByRole('main').getByRole('link').filter({hasText:'Bienes de uso y amortizaciones'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
});
