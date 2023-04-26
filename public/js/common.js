/* global moment */
class UpiError {
    constructor(error) {
        this.error = error;
    }

    get explanation() {
        if (this.error.statusCode !== undefined) {
            switch (this.error.statusCode) {
                case 400: return "Virhe tietojen haussa. Ota yhteyttä ylläpitäjään.";
                case 402: return "Maksuraja on näköjään ylitetty. Ota yhteyttä ylläpitäjään.";
                case 404: return "Käsiteltävää tietoa ei (enää) löydy tietokannasta. Yritä uudestaan päivitettyäsi viimeisimmät tiedot (käynnistä sovellus uudestaan).";
                case 405: return "Virhe HTTP-pyynnössä. Ota yhteyttä ylläpitäjään.";
                case 409: return "Tietoja on päivitetty jonkun muun toimesta. Yritä uudestaan päivitettyäsi viimeisimmät tiedot tietokannasta.";
                case 417: return "Useiden tietojen käsittely kerralla epäonnistui. Ota yhteyttä ylläpitäjään.";
                case 429: return "Järjestelmässä on tehty liian monta pyyntöä lyhyen ajan sisällä. Yritä uudestaan myöhemmin.";
                case 500: return "Jotain meni pieleen palvelinpäässä. Ota yhteyttä ylläpitäjään.";
                case 503: return "Tietokantaan ei saada yhteyttä. Ota yhteyttä ylläpitäjään.";
                default: return "Tuntematon paluukoodi " + this.error.statusCode;
            }
        }
        if (this.error.message !== undefined) {
            return this.error.message;
        }

        return this.error;
    }
}

function uuid() {
    var uuid = "",
        i, random;
    for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;

        if (i == 8 || i == 12 || i == 16 || i == 20) {
            uuid += "-"
        }
        uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
    }
    return uuid;
}

function generateTimestamp() {
    return moment().format("DD.MM.YYYY HH:mm.ss");
}