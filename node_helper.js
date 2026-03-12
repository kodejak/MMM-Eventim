var NodeHelper = require("node_helper");
var https = require("https");
var http = require("http");
var url = require("url");

module.exports = NodeHelper.create({

    start: function () {
        console.log("MMM-Eventim node_helper started");
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "FETCH_EVENTS") {
            this.fetchProducts(payload.url);
        }
    },

    fetchProducts: function (apiUrl) {
        var self = this;
        var parsedUrl = url.parse(apiUrl);
        var transport = parsedUrl.protocol === "https:" ? https : http;

        var options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
            path: parsedUrl.path,
            method: "GET",
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Cache-Control": "no-cache",
            }
        };

        var req = transport.request(options, function (res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log("MMM-Eventim: redirection to" + res.headers.location);
                self.fetchProducts(res.headers.location);
                return;
            }

            var data = "";

            res.on("data", function (chunk) {
                data += chunk;
            });

            res.on("end", function () {
                console.log("MMM-Eventim: HTTP status " + res.statusCode);
                console.log("MMM-Eventim: answer (first 100 characters: " + data.substring(0, 200));

                try {
                    var parsed = JSON.parse(data);
                    self.sendSocketNotification("EVENTS_DATA", parsed);
                } catch (e) {
                    console.error("MMM-Eventim: JSON parsing error:", e.message);
                    self.sendSocketNotification("EVENTS_ERROR", {
                        error: "JSON parsing error (HTTP " + res.statusCode + "): " + e.message
                    });
                }
            });
        });

        req.on("error", function (e) {
            console.error("MMM-Eventim: HTTP error:", e.message);
            self.sendSocketNotification("EVENTS_ERROR", {
                error: "API not reachable: " + e.message
            });
        });

        req.setTimeout(10000, function () {
            req.destroy();
            self.sendSocketNotification("EVENTS_ERROR", {
                error: "Timeout on API request"
            });
        });

        req.end();
    },
});
