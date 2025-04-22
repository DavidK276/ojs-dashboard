export type CsvRow = {
    givenName: string | null,
    familyName: string | null,
    email: string | null,
    affiliation: string | null,
    country: string | null,
    comments: string | null,
    issues: string;
};

const VALID_UNIVERSITY_LIST = [
    'University of Ljubljana',
    'Comenius University Bratislava',
    'Comenius University in Bratislava',
    'University of Vienna',
    'Eötvös Loránd University'
];

const VALID_EMAIL_DOMAINS = [
    'uni-lj.si',
    'uniba.sk',
    'univie.ac.at',
    'elte.hu'
];

export function isAffiliationValid(affiliation: string) {
    return VALID_UNIVERSITY_LIST.includes(affiliation);
}

export function isUniversityEmail(email: string) {
    return VALID_EMAIL_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
}


export function downloadCSV(filename: string, csv: string) {
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv))
    element.setAttribute('download', filename)

    element.style.display = 'none'
    document.body.appendChild(element)

    element.click()
    document.body.removeChild(element)
}