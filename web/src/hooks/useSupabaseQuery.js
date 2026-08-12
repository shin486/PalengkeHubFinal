import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook for fetching data from Supabase with loading, error, and refetch support.
 * @param {string} table - The Supabase table name
 * @param {object} options - Query options (select, filters, order, limit, etc.)
 * @param {boolean} enabled - Whether to auto-fetch on mount
 * @returns {object} { data, loading, error, refetch }
 */
export function useSupabaseQuery(table, options = {}, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const execute = useCallback(async (opts = {}) => {
    const queryOpts = { ...options, ...opts };
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from(table).select(queryOpts.select || '*');

      if (queryOpts.eq) {
        Object.entries(queryOpts.eq).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
      }

      if (queryOpts.neq) {
        Object.entries(queryOpts.neq).forEach(([col, val]) => {
          query = query.neq(col, val);
        });
      }

      if (queryOpts.in) {
        Object.entries(queryOpts.in).forEach(([col, arr]) => {
          query = query.in(col, arr);
        });
      }

      if (queryOpts.gte) {
        Object.entries(queryOpts.gte).forEach(([col, val]) => {
          query = query.gte(col, val);
        });
      }

      if (queryOpts.lte) {
        Object.entries(queryOpts.lte).forEach(([col, val]) => {
          query = query.lte(col, val);
        });
      }

      if (queryOpts.order) {
        query = query.order(queryOpts.order.column, { ascending: queryOpts.order.ascending ?? false });
      }

      if (queryOpts.limit) {
        query = query.limit(queryOpts.limit);
      }

      if (queryOpts.count) {
        query = query.select(queryOpts.select || '*', { count: 'exact', head: true });
      }

      const result = await query;

      if (result.error) throw result.error;

      if (queryOpts.count) {
        setData(result.count || 0);
      } else {
        setData(result.data || []);
      }
      return result;
    } catch (err) {
      setError(err);
      console.error(`Supabase query error for table '${table}':`, err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  }, [table, JSON.stringify(options)]);

  const refetch = useCallback(() => execute(), [execute]);

  useEffect(() => {
    if (enabled) {
      execute();
    }
  }, [execute, enabled]);

  return { data, loading, error, refetch };
}

/**
 * Hook for fetching a single record by ID.
 */
export function useSupabaseRecord(table, id, select = '*') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from(table)
        .select(select)
        .eq('id', id)
        .single();
      if (err) throw err;
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [table, id, select]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for real-time subscriptions to a Supabase table.
 */
export function useSupabaseSubscription(table, callback, filter = null) {
  useEffect(() => {
    let query = supabase.from(table).on('*', (payload) => {
      callback(payload);
    });

    if (filter) {
      query = query.eq(filter.column, filter.value);
    }

    const subscription = query.subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, [table, callback, JSON.stringify(filter)]);
}