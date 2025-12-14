import { NextResponse } from 'next/server'
import { AUTOMATION_RECIPES, installRecipe, installAllRecipes } from '@/lib/automation/recipes'

export async function GET() {
  const recipes = AUTOMATION_RECIPES.map(r => ({
    id: r.id, name: r.name, description: r.description,
    category: r.category, icon: r.icon, tags: r.tags,
  }))
  return NextResponse.json(recipes)
}

export async function POST(req: Request) {
  const { recipe_id, organization_id, install_all, category } = await req.json()
  if (!organization_id) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  if (install_all) {
    const result = await installAllRecipes(organization_id, category)
    return NextResponse.json(result)
  }

  if (!recipe_id) return NextResponse.json({ error: 'recipe_id required' }, { status: 400 })

  const result = await installRecipe(organization_id, recipe_id)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, rule_id: result.ruleId })
}
