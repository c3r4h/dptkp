document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggleBtn");
  const sidebar = document.getElementById("sidebar");
  const mapWrapper = document.getElementById("mapWrapper");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("translate-x-0");
    mapWrapper.classList.toggle("sm:ml-80");
    // recalc list/map after sidebar state changes in case layout or visible items need refresh
    if (typeof applyFilters === 'function') applyFilters();
  });

  const map = L.map('map').setView([-7.825335351853033, 110.37492201112681], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  const markersCluster = L.markerClusterGroup();
  map.addLayer(markersCluster);

  // keep track of currently selected marker so we can un-highlight it
  let selectedMarker = null;

  function svgIcon(color, selected = false) {
    // if selected, draw a thicker border or make it larger
    const border = selected ? '2px solid #000' : 'none';
    const size = selected ? 22 : 18;
    const margin = selected ? 16 : 18; // adjust margin-top to keep bottom anchor
    return L.divIcon({
      className: "",
      html: `<div style="
              margin-top: ${margin}px;
              background:${color};
              width:${size}px;
              height:${size}px;
              border-radius:50%;
              border:${border};
              ">
            </div>`,
      iconSize: [36,36],
      iconAnchor: [18,36], // titik bawah marker pas di koordinat
      popupAnchor: [0,-36]
    });
  }

  let categoryColors = {};
  let allLocations = [];
  let userCoords = null;

  // =======================
  // FETCH CATEGORY.JSON
  // =======================
  fetch('category.json')
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById("categoryFilter");
      categories.forEach(cat => {
        categoryColors[cat.id] = cat.color;
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
      });
    });

  // =======================
  // FETCH MARKERS.JSON
  // =======================
  fetch('dipetakopi-20260227101014.json')
    .then(res => res.json())
    .then(locations => {
      allLocations = locations;
      applyFilters();
    })
    .catch(err => console.error("Failed to load markers", err));

  // =======================
  // RENDER MARKERS
  // =======================
  // show details using our custom bottom modal instead of Leaflet popup
  function showLocationModal(loc) {
    if (!locModalContent || !locModal) return;
    locModalContent.innerHTML = popupContent(loc);
    // slide modal up
    locModal.classList.remove('translate-y-full');
  }

  function resetMarker(marker) {
    if (!marker) return;
    const color = marker._origColor || "#6b7280";
    marker.setIcon(svgIcon(color, false));
  }

  function selectMarker(marker) {
    if (!marker) return;
    if (selectedMarker && selectedMarker !== marker) {
      resetMarker(selectedMarker);
    }
    // if already selected do nothing
    if (selectedMarker === marker) return;
    const color = marker._origColor || "#6b7280";
    marker.setIcon(svgIcon(color, true));
    selectedMarker = marker;
  }

  function renderMarkers(data) {
    // clear previous selection
    selectedMarker = null;

    markersCluster.clearLayers();
    data.forEach(loc => {
      const color = categoryColors[loc.category[0]] || "#6b7280";
      const marker = L.marker([loc.lat, loc.lng], { icon: svgIcon(color) });
      marker._origColor = color;
      // when marker is clicked, open our modal instead of a popup
      marker.on('click', () => {
        showLocationModal(loc);
        selectMarker(marker);
      });
      markersCluster.addLayer(marker);
      loc.markerRef = marker;
    });
  }

  function popupContent(loc) {
    const carParking = loc.parking.car >= 5 ? "+5" : loc.parking.car;
    const motorParking = loc.parking.motor >= 5 ? "+5" : loc.parking.motor;

    const routeLink = userCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${loc.lat},${loc.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;

    var output = `<div style="font-family: 'Nunito', sans-serif;">
      <h2 class="font-bold text-lg mb-2 leading-none">${loc.name}</h2>
      <div class="text-xs">
        <div>Kategori: ${loc.category.join(", ")}</div>
        <div class="${loc.info ? '' : 'hidden'}">Info: ${loc.info ?? ''}</div>
        <div class="mb-2">Open: ${loc.open_hours} - ${loc.close_hours}</div>
        
        <div class="${loc.tubruk ? '' : 'hidden'}">
          Tubruk: Rp${new Intl.NumberFormat('id-ID').format(loc.tubruk)}</div>
        <div class="mb-2">Hot Americano: Rp${new Intl.NumberFormat('id-ID').format(loc.hot_coffee)}</div>
        
        <div>Indoor AC: ${loc.ac ? "yes" : "no"}</div>
        <div class="mb-2">Smoking: ${loc.smoking}</div>
        
        <div class="mb-2 border-b border-gray-200 pb-3 mb-3">
          Parking: Car ${carParking}, Motor ${motorParking}
        </div>
      </div>
      
      <div class="flex flex-wrap gap-2">
        <a href="${loc.gmaps}" target="_blank"
          class="text-xs inline-flex items-center justify-center gap-1 mb-1 border border-blue-500 text-blue-500 px-3 py-2 rounded hover:bg-blue-50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
          </svg>
          Google Maps
        </a>

        <!-- Tombol Rute -->
        <a href="${routeLink}" target="_blank"
          class="text-xs inline-flex items-center justify-center gap-1 mb-1 border border-blue-500 text-blue-500 px-3 py-2 rounded hover:bg-blue-50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="12" height="12" fill="currentColor">
              <path d="M512 96c0 50.2-59.1 125.1-84.6 155-3.8 4.4-9.4 6.1-14.5 5L320 256c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c53 0 96 43 96 96s-43 96-96 96l-276.4 0c8.7-9.9 19.3-22.6 30-36.8 6.3-8.4 12.8-17.6 19-27.2L416 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0c-53 0-96-43-96-96s43-96 96-96l39.8 0c-21-31.5-39.8-67.7-39.8-96 0-53 43-96 96-96s96 43 96 96zM117.1 489.1c-3.8 4.3-7.2 8.1-10.1 11.3l-1.8 2-.2-.2c-6 4.6-14.6 4-20-1.8-25.2-27.4-85-97.9-85-148.4 0-53 43-96 96-96s96 43 96 96c0 30-21.1 67-43.5 97.9-10.7 14.7-21.7 28-30.8 38.5l-.6 .7zM128 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM416 128a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/>
            </svg>
            Rute
        </a>`;

      if (loc.instagram) {
        output += `<a href="${loc.instagram}" target="_blank"
            class="text-xs inline-flex items-center justify-center gap-1 mb-1 border border-blue-500 text-blue-500 px-3 py-2 rounded hover:bg-blue-50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 1.5A4.25 4.25 0 003.5 7.75v8.5A4.25 4.25 0 007.75 20.5h8.5a4.25 4.25 0 004.25-4.25v-8.5A4.25 4.25 0 0016.25 3.5h-8.5zm4.25 3.25a5.25 5.25 0 110 10.5 5.25 5.25 0 010-10.5zm0 1.5a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5zm4.75-.75a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z"/>
            </svg>
            Instagram
          </a>`;
      }

    output += `
        </div>
      </div>`;
    
    return output;
  }

  function renderSidebarList(data) {
    const container = document.getElementById('locationList');
    if (!container) return;

    container.innerHTML = "";

    if (data.length == 0) {
      container.innerHTML = "Not found.";
    }

    data.forEach(loc => {
      const div = document.createElement("div");
      div.className = "border-t py-2 cursor-pointer";
      div.innerHTML = `<div class="hover:opacity-60">
                          <div class="font-bold mr-1 w-2/3 leading-none">${loc.name}</div>
                          <div class="text-xs">
                            ${loc.category.join(", ")}<br>
                            ${loc.open_hours} - ${loc.close_hours}
                          <div class="text-xs>${loc.category.join(", ")}</div>
                        </div>`;
      div.onclick = () => {
        const latlng = [loc.lat, loc.lng];
        // Zoom in
        map.setView(latlng, 15, { animate: true });
        // Pan in
        setTimeout(() => {
          map.panBy([0, 100], { animate: true });
        }, 200);
        showLocationModal(loc);
        selectMarker(loc.markerRef);
        sidebar.classList.remove("translate-x-0");
      };
      container.appendChild(div);
    });
  }

  // =======================
  // CALCULATE DISTANCE (Haversine)
  // =======================
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // =======================
  // APPLY FILTERS (SEARCH)
  // =======================
  function applyFilters() {
    const selectedCategory = document.getElementById("categoryFilter").value;
    const kopiTubruk = document.getElementById("kopiTubruk").checked;
    const acFilter = document.getElementById("acFilter").checked;
    const smokingAC = document.getElementById("smokingAC").checked;
    const carFriendly = document.getElementById("parkingFilter").checked;
    const sortNearest = document.getElementById("sortNearest").checked;
    const searchText = document.getElementById("searchInput").value.toLowerCase();

    let filtered = allLocations;

    if (selectedCategory) {
      filtered = filtered.filter(loc => loc.category.includes(selectedCategory));
    }

    if (kopiTubruk) {
      filtered = filtered.filter(loc => loc.tubruk > 0);
    }

    if (acFilter) {
      filtered = filtered.filter(loc => loc.ac == true);
    }

    if (smokingAC) {
      filtered = filtered.filter(loc => loc.smoking.toLowerCase().includes('ac'));
    }

    if (carFriendly) {
      filtered = filtered.filter(loc => loc.parking.car > 3);
    }

    if (searchText) {
      filtered = filtered.filter(loc => loc.name.toLowerCase().includes(searchText));
    }

    if (sortNearest && userCoords) {
      filtered = filtered.map(loc => ({
        ...loc,
        distance: getDistance(userCoords.lat, userCoords.lng, loc.lat, loc.lng)
      })).sort((a,b) => a.distance - b.distance);
    }

    renderMarkers(filtered);
    renderSidebarList(filtered);
  }

  // modal references (bottom quarter screen)
  const locModal = document.getElementById('locModal');
  const locModalContent = document.getElementById('locModalContent');
  const closeLocModal = document.getElementById('closeLocModal');

  if (closeLocModal) {
    closeLocModal.addEventListener('click', () => {
      if (locModal) locModal.classList.add('translate-y-full');
      // remove highlight on close
      if (selectedMarker) {
        resetMarker(selectedMarker);
        selectedMarker = null;
      }
    });
  }

  if (locModal) {
    locModal.addEventListener('click', (e) => {
      if (e.target === locModal) {
        locModal.classList.add('translate-y-full');
        if (selectedMarker) {
          resetMarker(selectedMarker);
          selectedMarker = null;
        }
      }
    });
  }

  // =======================
  // GET USER LOCATION
  // =======================
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      applyFilters();
    });
  }

  // =======================
  // EVENT LISTENERS
  // =======================
  // clear search text when clicking/focusing on the input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("click", () => {
      searchInput.value = "";
      applyFilters();
    });
    // also clear on focus for better UX
    searchInput.addEventListener("focus", () => {
      searchInput.value = "";
    });
    // filter results while typing
    searchInput.addEventListener("keyup", () => {
      applyFilters();
    });
    // support enter key as well
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        applyFilters();
      }
    });
  }

  document.querySelectorAll(".filterInput").forEach(el => {
    el.addEventListener("change", applyFilters);
  });
});
