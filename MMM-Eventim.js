Module.register("MMM-Eventim", {

    defaults: {
        updateInterval: 60 * 1000,
        animationSpeed: 1000,
        maxItems: 10,
        language: "de",
        cities: ["Berlin"],
        categories:["Konzerte"],
        searchTerm: "Indie", // e.g. Rock & Roll
        inStock: true,
        showPrice: true,
        showVenue: true,
        venues: [], // Wanted venues - empty when all
    },

    events: [],
    loaded: false,
    errorMessage: null,

    start: function () {
        Log.info("MMM-Eventim: modul started");
        this.fetchData();
        this.scheduleUpdate();
    },

    scheduleUpdate: function () {
        var self = this;
        setInterval(function () {
            self.fetchData();
        }, this.config.updateInterval);
    },

    buildUrl: function() {
        var self = this;
        var dates = this.getDateRange();
        var url = "https://public-api.eventim.com/websearch/search/api/exploration/v1/products?webId=web__eventim-de&language=" 
            + this.config.language + "&page=1&date_from=" + dates.start + "&date_to=" + dates.end + "&sort=DateAsc&=&top=50";
        var cities = this.config.cities.join();
        var categories = this.config.categories.join();
        var searchTerm = this.config.searchTerm;
        var inStock = this.config.inStock;

        if (cities.length > 0 && cities !== undefined) {
            url = url + "&city_names=" + cities;
        }
        if (categories.length > 0 && categories !== undefined) {
            url = url + "&categories=" + categories;
        }
        if (searchTerm.length > 0 && searchTerm !== undefined) {
            url = url + "&search_term=" + searchTerm;
        } 
        if (inStock !== undefined) {
            url = url + "&in_stock=" + inStock;
        }

        return url;
    },

    getDateRange: function () {
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, "0"); };
        var start = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
        var endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        var end = endDate.getFullYear() + "-" + pad(endDate.getMonth() + 1) + "-" + pad(endDate.getDate());
        return {
            start: start,
            end:   end,
        };
    },

    fetchData: function () {
        var self = this;

        fetch(this.buildUrl(), {
            method: "GET",
            headers: {
                "Accept": "application/json",
            }
        })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            self.errorMessage = null;
            self.events = [];

            if (data && (Array.isArray(data.products) || data.products.size > 1)) {
                var venueFilter = self.config.venues;
                var filtered = data.products.filter(function (p) {
                    if (!venueFilter || venueFilter.length === 0) return true;
                    var venueName = p.typeAttributes &&
                                   p.typeAttributes.liveEntertainment &&
                                   p.typeAttributes.liveEntertainment.location &&
                                   p.typeAttributes.liveEntertainment.location.name;
                    if (!venueName) return false;
                    return venueFilter.some(function (v) {
                        return venueName.toLowerCase().indexOf(v.toLowerCase()) !== -1;
                    });
                });
                self.events = filtered.slice(0, self.config.maxItems);

            }

            self.loaded = true;
            self.updateDom(self.config.animationSpeed);
        })
        .catch(function (err) {
            console.error("MMM-Eventim fetch error:", err);
            self.errorMessage = err.message;
            self.loaded = true;
            self.updateDom(self.config.animationSpeed);
        });
    },

    formatDate: function (isoString) {
        if (!isoString) return null;
        var d = new Date(isoString);
        var day   = String(d.getDate()).padStart(2, "0");
        var month = String(d.getMonth() + 1).padStart(2, "0");
        var hours = String(d.getHours()).padStart(2, "0");
        var mins  = String(d.getMinutes()).padStart(2, "0");
        return day + "." + month + "." + d.getFullYear() + " " + hours + ":" + mins;
    },

    getTemplate: function () {
        return "MMM-Eventim.njk";
    },

    getTemplateData: function () {
        var self = this;

        var venueFilter = this.config.venues || [];
        var venueLegend = venueFilter.map(function (v, i) {
            return { nr: i + 1, name: v };
        });

        // Venue-Nummer anhand location.name ermitteln
        var getVenueNr = function (locationName) {
            if (!locationName || venueFilter.length === 0) return null;
            for (var i = 0; i < venueFilter.length; i++) {
                if (locationName.toLowerCase().indexOf(venueFilter[i].toLowerCase()) !== -1) {
                    return i + 1;
                }
            }
            return null;
        };

        var enriched = this.events.map(function (p, i) {
            var rawDate = p.typeAttributes &&
                          p.typeAttributes.liveEntertainment &&
                          p.typeAttributes.liveEntertainment.startDate;

            var locationName = p.typeAttributes &&
                               p.typeAttributes.liveEntertainment &&
                               p.typeAttributes.liveEntertainment.location &&
                               p.typeAttributes.liveEntertainment.location.name;

            var formattedPrice = null;
            if (p.price != null) {
                formattedPrice = p.price.toFixed(0).replace(".", ",") + " " + (p.currency || "EUR");
            }

            return {
                name:           p.name || null,
                formattedDate:  self.formatDate(rawDate),
                formattedPrice: formattedPrice,
                venueName:      locationName || null,
                venueNr:        getVenueNr(locationName),
            };
        });

        return {
            loaded:         this.loaded,
            error:          this.errorMessage,
            events:         enriched,
            showPrice:      this.config.showPrice,
            showVenue:      this.config.showVenue,
            venueLegend:    venueLegend,
        };
    },

    getTranslations: function () {
        return {
            de: "translations/de.json",
            en: "translations/en.json",
        };
    },

    getStyles: function () {
        return ["MMM-Eventim.css"];
    },
});
