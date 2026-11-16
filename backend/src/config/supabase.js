const { createClient } = require('@supabase/supabase-js');
const { assertStorageEnvironment } = require('./storageConfig');

let cachedClient = null;

const getSupabaseClient = () => {
    if (cachedClient) {
        return cachedClient;
    }

    assertStorageEnvironment(process.env);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    return cachedClient;
};

module.exports = {
    getSupabaseClient,
};
