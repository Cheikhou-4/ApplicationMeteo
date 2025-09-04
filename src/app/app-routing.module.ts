import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { FavorisComponent } from './favoris/favoris.component';
import { AproposComponent } from './apropos/apropos.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'favoris', component: FavorisComponent },
  { path: 'apropos', component: AproposComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
