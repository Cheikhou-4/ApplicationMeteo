
import * as L from 'leaflet';
import { Component } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})


export class HomeComponent {
  // --- Propriétés ---
  showConseils = false;
  map: L.Map | null = null;
  mapReady = false;
  city: string = '';
  searchedCity: string | null = null;
  weather: any = null;
  forecasts: any[] = [];
  error: string | null = null;
  loading: boolean = false;
  favoris: string[] = [];
  citySuggestions: string[] = [];
  private cityInput$ = new Subject<string>();

  public tempChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Température (°C)',
        fill: true,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        tension: 0.3,
        pointBackgroundColor: '#1976d2',
        pointBorderColor: '#fff',
        pointRadius: 5
      }
    ]
  };
  public tempChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 1,
    plugins: {
      legend: { display: true },
      title: { display: true, text: 'Évolution des températures sur 5 jours' }
    },
    scales: {
      y: { beginAtZero: false }
    }
  };

  public tempChartType: ChartType = 'line';

  // Conseils pratiques dynamiques selon la ville/pays
  get conseilsPratiques(): string[] {
    if (this.weather?.sys?.country === 'SN') {
      return [
        "Protégez-vous du soleil (crème, chapeau, hydratation), surtout entre 11h et 16h.",
        "En cas d’orage : évitez les zones dégagées, abritez-vous à l’intérieur, ne vous abritez pas sous un arbre.",
        "En période de forte chaleur : limitez les efforts physiques, buvez régulièrement, surveillez les personnes fragiles.",
        "En cas de pluie intense : attention aux routes glissantes et aux inondations locales."
      ];
    } else {
      return [
        "Adaptez votre protection solaire selon l’ensoleillement local.",
        "En cas d’orage : restez à l’abri, évitez les zones à risque.",
        "En cas de chaleur ou de froid extrême : surveillez la météo et ajustez vos activités.",
        "Prudence sur la route en cas de pluie, neige ou verglas."
      ];
    }
  }


  get donneesClimatiques(): string[] {
    if (this.weather?.sys?.country === 'SN') {
      return [
        "Deux saisons principales : saison sèche (novembre à mai) et saison des pluies (juin à octobre).",
        "La saison des pluies est cruciale pour l’agriculture et la pêche : surveillez les prévisions pour planifier vos activités.",
        "Les températures varient fortement selon la saison et l’heure de la journée.",
        "Pour les agriculteurs et pêcheurs : adaptez vos pratiques selon la météo du jour et les tendances saisonnières."
      ];
    } else {
      return [
        "Renseignez-vous sur les saisons locales pour mieux planifier vos activités.",
        "Les conditions climatiques varient selon la région et l’altitude.",
        "Pour l’agriculture et la pêche : consultez les prévisions météo locales et les tendances saisonnières.",
        "Adaptez vos pratiques selon la météo du jour et les alertes locales."
      ];
    }
  }

  getBackgroundClass(): string {
    if (!this.weather) return 'meteo-bg meteo-bg-default';
    const icon = this.weather.weather?.[0]?.icon || '';
    if (icon.includes('n')) return 'meteo-bg meteo-bg-night';
    if (icon.startsWith('09') || icon.startsWith('10') || icon.startsWith('11')) return 'meteo-bg meteo-bg-rain';
    if (icon.startsWith('01')) return 'meteo-bg meteo-bg-sun';
    return 'meteo-bg meteo-bg-default';
  }

  constructor(private http: HttpClient) {
    this.loadFavoris();
    this.cityInput$
      .pipe(debounceTime(300))
      .subscribe((value) => {
        this.fetchCitySuggestions(value);
      });
    // Vérifie la présence de Leaflet
    console.log('Leaflet version:', L.version);
  }

  ngOnInit(): void {
    // Géolocalisation automatique au chargement
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const apiKey = 'ee2aba0cfbc87cbd888a2491c1a3afca';
          const urlWeather = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;
          const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;
          this.loading = true;
          this.http.get(urlWeather).subscribe({
            next: (data: any) => {
              this.weather = data;
              this.city = data.name;
              this.searchedCity = data.name;
              this.error = null;
              this.http.get(urlForecast).subscribe({
                next: (fdata: any) => {
                  this.forecasts = this.extractDailyForecasts(fdata.list);
                  this.updateTempChart();
                  this.loading = false;
                  this.tryInitMap();
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
          // Ne rien faire si refus, l'utilisateur peut utiliser la recherche manuelle
        }
      );
    }
  }

  // --- Méthodes principales ---
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
            this.updateTempChart();
            this.loading = false;
            this.tryInitMap();
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

  onCityInput(value: string) {
    this.cityInput$.next(value);
  }

  onCityInputEvent(event: Event) {
    const value = (event.target as HTMLInputElement)?.value || '';
    this.onCityInput(value);
  }

  fetchCitySuggestions(query: string) {
    if (!query || query.length < 2) {
      this.citySuggestions = [];
      return;
    }
    this.http.get<any>(
      `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(query)}&limit=5&sort=-population`,
      {
        headers: {
          'X-RapidAPI-Key': '', // Optionnel, fonctionne sans clé pour 5 requêtes/sec
          'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
        }
      }
    ).subscribe({
      next: (res) => {
        this.citySuggestions = res.data.map((c: any) => `${c.city}, ${c.countryCode}`);
      },
      error: () => {
        this.citySuggestions = [];
      }
    });
  }

  selectCitySuggestion(s: string) {
    this.city = s;
    this.citySuggestions = [];
  }

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
                this.tryInitMap();
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

  // --- Favoris ---
  loadFavoris() {
    const fav = localStorage.getItem('meteo_favoris');
    this.favoris = fav ? JSON.parse(fav) : [];
  }

  saveFavoris() {
    localStorage.setItem('meteo_favoris', JSON.stringify(this.favoris));
  }

  toggleFavori() {
    if (!this.searchedCity) return;
    const idx = this.favoris.indexOf(this.searchedCity);
    if (idx === -1) {
      this.favoris.push(this.searchedCity);
    } else {
      this.favoris.splice(idx, 1);
    }
    this.saveFavoris();
  }

  isFavori(): boolean {
    return !!this.searchedCity && this.favoris.includes(this.searchedCity);
  }

  // --- Graphique ---
  updateTempChart() {
    if (!this.forecasts || this.forecasts.length === 0) {
      this.tempChartData.labels = [];
      this.tempChartData.datasets[0].data = [];
      return;
    }
    this.tempChartData.labels = this.forecasts.map(f => {
      const d = new Date(f.date);
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    });
    this.tempChartData.datasets[0].data = this.forecasts.map(f => f.temp);
  }

  // --- Prévisions ---
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

  // --- Carte Leaflet ---
  private tryInitMap() {
    setTimeout(() => {
      try {
        if (this.map) {
          this.map.remove();
          this.map = null;
        }
        const mapDiv = document.getElementById('meteo-map');
        if (this.weather && mapDiv) {
          const lat = this.weather.coord?.lat || 14.6928;
          const lon = this.weather.coord?.lon || -17.4467;
          this.map = L.map('meteo-map').setView([lat, lon], 8);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(this.map);
          // Couche pluie OpenWeatherMap
          L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=ee2aba0cfbc87cbd888a2491c1a3afca', {
            attribution: '© OpenWeatherMap', opacity: 0.7
          }).addTo(this.map);
          this.mapReady = true;
        }
      } catch (e) {
        console.error('[LEAFLET ERROR]', e);
      }
    }, 400);
  }

  // --- Partage social ---
  get shareText(): string {
    if (!this.weather) return '';
    const ville = this.weather.name;
    const pays = this.weather.sys?.country || '';
    const temp = Math.round(this.weather.main?.temp);
    const desc = this.weather.weather?.[0]?.description || '';
    return `Météo à ${ville}${pays ? ', ' + pays : ''} : ${temp}°C, ${desc}. Via MeteoSN 🌤️`;
  }

  get whatsappShareUrl(): string {
    return `https://wa.me/?text=${encodeURIComponent(this.shareText)}`;
  }

  get twitterShareUrl(): string {
    const url = window.location.href;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.shareText)}&url=${encodeURIComponent(url)}`;
  }

  get facebookShareUrl(): string {
    const url = window.location.href;
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(this.shareText)}`;
  }
}



