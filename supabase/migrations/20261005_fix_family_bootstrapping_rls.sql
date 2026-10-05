-- =============================================================================
-- Migration: Fix Family Bootstrapping Circular RLS Dependency
-- Date: 2026-10-05
-- Targets: public.families, public.family_members
--
-- Problem:
-- 1. public.families SELECT policy ("Members can view their family") only permitted
--    is_member_of_family(id). A newly created family could NOT be read by its
--    creator prior to the creation of the initial family_members record.
-- 2. public.family_members INSERT policy evaluated an inline subquery against
--    public.families under the caller's RLS context, causing a circular lock:
--    the creator could not see their own family row, failing the WITH CHECK.
--
-- Solution:
-- 1. Create a SECURITY DEFINER helper function public.is_family_creator(f_id UUID)
--    that verifies if auth.uid() created the specified family row.
-- 2. Update public.families SELECT policy so the family creator (created_by = auth.uid())
--    or an established member can read the family.
-- 3. Update public.family_members INSERT policy to allow:
--    - established parents (is_parent_in_family)
--    - initial creator inserting their own profile (profile_id = auth.uid() AND is_family_creator(family_id))
-- =============================================================================

-- 1. Helper function: Check if current authenticated user is the creator of a family
CREATE OR REPLACE FUNCTION public.is_family_creator(f_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.families
        WHERE id = f_id
          AND created_by = auth.uid()
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_family_creator(UUID) TO authenticated;

-- 2. Update public.families SELECT policy
DROP POLICY IF EXISTS "Members can view their family" ON public.families;
DROP POLICY IF EXISTS "Members and creator can view their family" ON public.families;

CREATE POLICY "Members and creator can view their family"
ON public.families FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    OR public.is_member_of_family(id)
);

-- 3. Update public.family_members INSERT policy
DROP POLICY IF EXISTS "Parents can add members or creator can add initial self" ON public.family_members;

CREATE POLICY "Parents can add members or creator can add initial self"
ON public.family_members FOR INSERT
TO authenticated
WITH CHECK (
    public.is_parent_in_family(family_id)
    OR (
        profile_id = auth.uid()
        AND public.is_family_creator(family_id)
    )
);
