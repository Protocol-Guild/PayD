class TenantService {
  constructor(TenantModel, UserModel) {
    this.TenantModel = TenantModel;
    this.UserModel = UserModel;
  }

  async createTenant(tenantData) {
    const tenant = await this.TenantModel.query().insert(tenantData);
    return tenant;
  }

  async getTenantById(tenantId) {
    const tenant = await this.TenantModel.query().findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    return tenant;
  }

  async getTenantUsers(tenantId) {
    return await this.UserModel.query().where('tenantId', tenantId);
  }

  async updateTenant(tenantId, updateData) {
    const tenant = await this.TenantModel.query().patchAndFetchById(tenantId, updateData);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    return tenant;
  }

  async deleteTenant(tenantId) {
    const deletedCount = await this.TenantModel.query().deleteById(tenantId);
    if (deletedCount === 0) {
      throw new Error('Tenant not found');
    }
    return true;
  }
}

module.exports = TenantService;
