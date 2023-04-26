/* global CloudantEntity, Store, resourceService */
/* exported OrganizationService, organizationService */

class Organization extends CloudantEntity {
    constructor(props = {}) {
        super(props);
        this.name = props.name;
        this.abbreviation = props.abbreviation;
    }
}

class OrganizationStore extends Store {
    constructor(items, name = "OrganizationStore") {
        super(items, name);
        this.organization = {};
    }

    get organizations() {
        return this.items;
    }

    set organizations(organizations) {
        this.items = organizations;
    }
}

var organizationCache = new OrganizationStore([], "OganizationCache");

class OrganizationService {

    constructor(props) {
        this.resourceService = props.resourceService;
    }

    async loadOrganizations() {
        if (organizationCache.organizations.length > 0) {
            return organizationCache.organizations;
        }
        let results = await this.resourceService.loadAll("organizations");
        let organizations = results.map(organization => { return new Organization(organization) });
        organizationCache.addAll(organizations);
        return organizations;
    }

    async loadOrganization(id) {
        let organization = organizationCache.getWithId(id);
        if (organization.notFound) {
            let result = await this.resourceService.load(`organization/${id}`);
            organizationCache.add(new Organization(result));
            return new Organization(result);    
        }
        return new Organization(organization);
    }
}

var organizationService = new OrganizationService({
    resourceService: resourceService
});