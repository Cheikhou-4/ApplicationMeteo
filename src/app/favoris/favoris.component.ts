import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-favoris',
  templateUrl: './favoris.component.html',
  styleUrls: ['./favoris.component.css']
})
export class FavorisComponent implements OnInit {
  favoris: string[] = [];
  meteoList: any[] = [];
  loading: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadFavoris();
    this.fetchMeteos();
  }

  loadFavoris() {
    const fav = localStorage.getItem('meteo_favoris');
    this.favoris = fav ? JSON.parse(fav) : [];
  }

  fetchMeteos() {
    this.meteoList = [];
    if (this.favoris.length === 0) return;
    this.loading = true;
    const apiKey = 'ee2aba0cfbc87cbd888a2491c1a3afca';
    let loaded = 0;
    for (const city of this.favoris) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
      this.http.get(url).subscribe({
        next: (data: any) => {
          this.meteoList.push(data);
          loaded++;
          if (loaded === this.favoris.length) this.loading = false;
        },
        error: () => {
          loaded++;
          if (loaded === this.favoris.length) this.loading = false;
        }
      });
    }
  }

  removeFavori(city: string) {
    this.favoris = this.favoris.filter((f: string) => f !== city.toLowerCase());
    localStorage.setItem('meteo_favoris', JSON.stringify(this.favoris));
    this.fetchMeteos();
  }
}
