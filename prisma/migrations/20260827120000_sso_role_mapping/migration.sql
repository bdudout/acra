-- RBAC piloté par l'IdP : claim de groupes + table de mapping groupe→rôle
ALTER TABLE "SSOConfig" ADD COLUMN "oidcGroupsClaim" TEXT DEFAULT 'groups';
ALTER TABLE "SSOConfig" ADD COLUMN "roleMapping" JSONB DEFAULT '{}';
