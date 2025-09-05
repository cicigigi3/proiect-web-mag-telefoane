const express = require("express");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const sass = require("sass");

app = express();


v = [10, 27, 24, 48, 15];

nrImpar = v.find(function (elem) {
  return elem % 100 == 1;
});
console.log(nrImpar);

console.log("Folderul proiectului: ", __dirname);
console.log("Calea fisierului index.js: ", __filename);
console.log("Folderul curent de lucru: ", process.cwd());

app.set("view engine", "ejs");

obGlobal = {
  obErori: null,
  obGalerie: null,
  folderScss: path.join(__dirname, "resurse/sass"),
  folderCss: path.join(__dirname, "resurse/css"),
  folderBackup: path.join(__dirname, "backup")
};

// Actualizeaza vect_foldere si adauga si folderele pentru galerie
vect_foldere = ["temp", "resurse/imagini/galerie/mic", "resurse/imagini/galerie/mediu","backup"];
for (let folder of vect_foldere) {
  let caleFolder = path.join(__dirname, folder);
  if (!fs.existsSync(caleFolder)) {
    fs.mkdirSync(caleFolder, { recursive: true }); // adauga {recursive: true} pentru a crea si subfolderele
  }
}

function initErori() {
  let continut = fs
    .readFileSync(path.join(__dirname, "resurse/json/erori.json"))
    .toString("utf-8");
  console.log(continut);
  obGlobal.obErori = JSON.parse(continut);
  console.log(obGlobal.obErori);

  obGlobal.obErori.eroare_default.imagine = path.join(
    obGlobal.obErori.cale_baza,
    obGlobal.obErori.eroare_default.imagine
  );
  for (let eroare of obGlobal.obErori.info_erori) {
    eroare.imagine = path.join(obGlobal.obErori.cale_baza, eroare.imagine);
  }
  console.log(obGlobal.obErori);
}


function initGalerie() {
  let continut = fs
    .readFileSync(path.join(__dirname, "resurse/json/galerie.json"))
    .toString("utf-8")
  obGlobal.obGalerie = JSON.parse(continut)
}

// Adaugă această funcție nouă
function filtreazaImagini() {
  const zileSaptamana = ["duminica", "luni", "marti", "miercuri", "joi", "vineri", "sambata"]
  let dataCurenta = new Date()
  console.log("Data curenta pe server este:", dataCurenta.toString())
  let numeZi = zileSaptamana[dataCurenta.getDay()]
  let imaginiFiltrate = []
  
  for (let img of obGlobal.obGalerie.imagini) {
    let afiseaza = false
    for (let interval of img.intervale_zile) {
      let startZi = zileSaptamana.indexOf(interval[0])
      let endZi = zileSaptamana.indexOf(interval[1])
      if (startZi <= dataCurenta.getDay() && dataCurenta.getDay() <= endZi) {
        afiseaza = true
        break
      }
    }
    if (afiseaza) {
      imaginiFiltrate.push(img)
    }
  }
  console.log("Imagini gasite inainte de trunchiere:", imaginiFiltrate);
  // Trunchiere la cel mai apropiat număr par, mai mic sau egal
  let nrImagini = imaginiFiltrate.length
  if (nrImagini % 2 !== 0) {
    nrImagini--
  }
  return imaginiFiltrate.slice(0, nrImagini)
}

// Adaugă această funcție nouă
function compileazaScss(caleScss, caleCss) {
  // Verificăm dacă primim căi absolute sau relative
  if (!path.isAbsolute(caleScss)) {
    caleScss = path.join(obGlobal.folderScss, caleScss);
  }

  // Generăm calea CSS dacă lipsește
  if (!caleCss) {
    let numeFisier = path.basename(caleScss, ".scss");
    caleCss = path.join(obGlobal.folderCss, numeFisier + ".css");
  } else if (!path.isAbsolute(caleCss)) {
    caleCss = path.join(obGlobal.folderCss, caleCss);
  }

  // Backup
  let folderBackupCss = path.join(obGlobal.folderBackup, "resurse/css");
  if (!fs.existsSync(folderBackupCss)) {
    fs.mkdirSync(folderBackupCss, { recursive: true });
  }

  if (fs.existsSync(caleCss)) {
    let numeFisierCss = path.basename(caleCss);
    try {
      fs.copyFileSync(caleCss, path.join(folderBackupCss, numeFisierCss));
    } catch (err) {
      console.error("Eroare la backup CSS:", err);
    }
  }

  // Compilare
  try {
    let rezultat = sass.compile(caleScss);
    fs.writeFileSync(caleCss, rezultat.css);
  } catch (err) {
    console.error("Eroare la compilare SCSS:", err);
  }
}

initErori()

initGalerie()


function afisareEroare(res, identificator, titlu, text, imagine) {
  let eroare = obGlobal.obErori.info_erori.find(function (elem) {
    return elem.identificator == identificator;
  });
  if (eroare) {
    if (eroare.status) res.status(identificator);
    var titluCustom = titlu || eroare.titlu;
    var textCustom = text || eroare.text;
    var imagineCustom = imagine || eroare.imagine;
  } else {
    var err = obGlobal.obErori.eroare_default;
    var titluCustom = titlu || err.titlu;
    var textCustom = text || err.text;
    var imagineCustom = imagine || err.imagine;
  }
  res.render("pagini/eroare", {
    //transmit obiectul locals
    titlu: titluCustom,
    text: textCustom,
    imagine: imagineCustom,
  });
}

app.use("/resurse", express.static(path.join(__dirname, "resurse")));

app.get("/favicon.ico", function (req, res) {
  res.sendFile(path.join(__dirname, "resurse/imagini/favicon/favicon.ico"));
});

app.get(["/", "/index", "/home"], function (req, res) {
  res.render("pagini/index", {
    ip: req.ip,
    imagini: filtreazaImagini(),
    cale_galerie: obGlobal.obGalerie.cale_galerie
  })
})

app.get("/galerie", function (req, res) {
  res.render("pagini/galerie", {
    imagini: filtreazaImagini(),
    cale_galerie: obGlobal.obGalerie.cale_galerie
  })
})

app.get("/resurse/imagini/galerie/:dim/:imagine", function(req, res) {
  let dim = req.params.dim;
  let imagine = req.params.imagine;

  if (dim !== "mic" && dim !== "mediu") {
    afisareEroare(res, 400);
    return;
  }
  
  let caleImagineOriginala = path.join(__dirname, "resurse/imagini/galerie", imagine);
  let caleImagineRedimensionata = path.join(__dirname, "resurse/imagini/galerie", dim, imagine);

  if (fs.existsSync(caleImagineRedimensionata)) {
    res.sendFile(caleImagineRedimensionata);
  } else if (fs.existsSync(caleImagineOriginala)) {
    let latime = (dim === "mic") ? 300 : 500;
    sharp(caleImagineOriginala)
      .resize({ width: latime })
      .toFile(caleImagineRedimensionata, function(err) {
        if (err) {
          console.error(err);
          afisareEroare(res, 500);
        } else {
          res.sendFile(caleImagineRedimensionata);
        }
      });
  } else {
    afisareEroare(res, 404);
  }
});

app.get("/index/a", function (req, res) {
  res.render("pagini/index");
});

app.get("/cerere", function (req, res) {
  res.send("<p style='color:blue'>Buna ziua</p>");
});

app.get("/fisier", function (req, res, next) {
  res.sendfile(path.join(__dirname, "package.json"));
});

app.get("/abc", function (req, res, next) {
  res.write("Data curenta: ");
  next();
});

app.get("/abc", function (req, res, next) {
  res.write(new Date() + "");
  res.end();
  next();
});

app.get("/abc", function (req, res, next) {
  console.log("------------");
});

app.get(/^\/resurse\/[a-zA-Z0-9_/]*$/, function (req, res) {
  afisareEroare(res, 403);
});

app.get("/*.ejs", function (req, res) {
  afisareEroare(res, 400);
});

app.get("/*", function (req, res) {
  try {
    res.render("pagini" + req.url, function (err, rezultatRandare) {
      if (err) {
        if (err.message.startsWith("Failed to lookup view")) {
          afisareEroare(res, 404);
        } else {
          afisareEroare(res);
        }
      } else {
        res.send(rezultatRandare);
      }
    });
  } catch (errRandare) {
    if (errRandare.message.startsWith("Cannot find module")) {
      afisareEroare(res, 404);
    } else {
      afisareEroare(res);
    }
  }
});

// Adaugă acest bloc de cod
fs.readdir(obGlobal.folderScss, function(err, fisiere) {
  if (err) {
    console.error("Eroare la citirea folderului SCSS:", err);
    return;
  }
  fisiere.forEach(function(fisier) {
    if (path.extname(fisier) === ".scss") {
      compileazaScss(fisier);
    }
  });
});

// Adaugă acest bloc nou
fs.watch(obGlobal.folderScss, function(eveniment, numeFisier) {
  console.log("Eveniment:", eveniment);
  if (numeFisier && path.extname(numeFisier) === ".scss") {
    console.log("S-a modificat fisierul:", numeFisier);
    compileazaScss(numeFisier);
  }
});


app.listen(8080);
console.log("Serverul a pornit");
