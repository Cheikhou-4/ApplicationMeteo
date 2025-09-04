import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})

export class HomeComponent {
  getMyPosition() {
    if (!navigator.geolocation) {
      this.error = "La géolocalisation n'est pas supportée par votre navigateur.";
      return;
    }
    this.loading = true;
    this.error = null;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const apiKey = 'ee2aba0cfbc87cbd888a2491c1a3afca';
        const urlWeather = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;
        const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;
        this.http.get(urlWeather).subscribe({
          next: (data: any) => {
            this.weather = data;
            this.city = data.name;
            this.searchedCity = data.name;
            this.error = null; // Efface l'erreur si succès
            this.http.get(urlForecast).subscribe({
              next: (fdata: any) => {
                this.forecasts = this.extractDailyForecasts(fdata.list);
                this.loading = false;
              },
              error: () => {
                this.error = "Erreur lors de la récupération des prévisions.";
                this.loading = false;
              }
            });
          },
          error: () => {
            this.error = "Erreur lors de la récupération de la météo de votre position.";
            this.loading = false;
          }
        });
      },
      (err) => {
        if (err.code === 1) {
          this.error = "Autorisation de géolocalisation refusée.";
        } else {
          this.error = "Impossible d'obtenir la position.";
        }
        this.loading = false;
      }
    );
  }
  city: string = '';
  searchedCity: string | null = null;
  weather: any = null;
  forecasts: any[] = [];
  error: string | null = null;
  loading: boolean = false;


  // Gestion des favoris
  favoris: string[] = [];

  constructor(private http: HttpClient) {
    this.loadFavoris();
  }

  loadFavoris() {
    const fav = localStorage.getItem('meteo_favoris');
    this.favoris = fav ? JSON.parse(fav) : [];
  }

  saveFavoris() {
    localStorage.setItem('meteo_favoris', JSON.stringify(this.favoris));
  }

  isFavori(): boolean {
    if (!this.weather) return false;
    return this.favoris.includes(this.weather.name.toLowerCase());
  }

  toggleFavori() {
    if (!this.weather) return;
    const city = this.weather.name.toLowerCase();
    if (this.isFavori()) {
      this.favoris = this.favoris.filter(f => f !== city);
    } else {
      this.favoris.push(city);
    }
    this.saveFavoris();
  }

  onSubmit() {
    this.searchedCity = this.city.trim();
    this.weather = null;
    this.forecasts = [];
    this.error = null;
    if (!this.searchedCity) return;
    this.loading = true;
    const apiKey = 'ee2aba0cfbc87cbd888a2491c1a3afca';
    const urlWeather = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(this.searchedCity)}&appid=${apiKey}&units=metric&lang=fr`;
    const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(this.searchedCity)}&appid=${apiKey}&units=metric&lang=fr`;

    // Appel météo actuelle
    this.http.get(urlWeather).subscribe({
      next: (data: any) => {
        this.weather = data;
        // Appel prévisions après succès météo actuelle
        this.http.get(urlForecast).subscribe({
          next: (fdata: any) => {
            this.forecasts = this.extractDailyForecasts(fdata.list);
            this.loading = false;
          },
          error: () => {
            this.error = "Erreur lors de la récupération des prévisions.";
            this.loading = false;
          }
        });
      },
      error: (err) => {
        this.error = "Ville non trouvée ou erreur réseau.";
        this.loading = false;
      }
    });
  }

  // Extrait 5 prévisions (une par jour à 12h)
  extractDailyForecasts(list: any[]): any[] {
    const result: any[] = [];
    const usedDates = new Set();
    for (const item of list) {
      const date = new Date(item.dt_txt);
      if (date.getHours() === 12) {
        const day = date.toDateString();
        if (!usedDates.has(day) && result.length < 5) {
          result.push({
            date: date,
            temp: Math.round(item.main.temp),
            icon: item.weather[0].icon,
            description: item.weather[0].description
          });
          usedDates.add(day);
        }
      }
    }
    // Si pas assez de jours à midi, compléter avec d'autres horaires
    if (result.length < 5) {
      for (const item of list) {
        const date = new Date(item.dt_txt);
        const day = date.toDateString();
        if (!usedDates.has(day) && result.length < 5) {
          result.push({
            date: date,
            temp: Math.round(item.main.temp),
            icon: item.weather[0].icon,
            description: item.weather[0].description
          });
          usedDates.add(day);
        }
      }
    }
    return result;
  }
}



