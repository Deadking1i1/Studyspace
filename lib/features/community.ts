import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { groupMembers, groups, posts, users } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { sanitizePlain } from "@/lib/text";

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/community?${type}=${encodeURIComponent(message)}`);
}

export async function createGroupAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const name = sanitizePlain(formData.get("name")).slice(0, 255);
  const description = sanitizePlain(formData.get("description"));
  if (!name || !description) redirectWith("Please provide a group name and description.", "error");

  const now = new Date();
  const [group] = await db
    .insert(groups)
    .values({ name, description, createdBy: user.id, createdAt: now, memberCount: 1 })
    .returning();
  await db.insert(groupMembers).values({ groupId: group.id, userId: user.id, joinedAt: now });
  revalidatePath("/community");
  revalidatePath("/groups");
  redirectWith("Study group created successfully.");
}

export async function createPostAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const content = sanitizePlain(formData.get("content"));
  const groupId = Number(formData.get("group_id") || 0) || null;
  if (!content) redirectWith("Post content is required.", "error");

  if (groupId) {
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);
    if (!member) redirectWith("You can only post to groups you belong to.", "error");
  }

  await db.insert(posts).values({ userId: user.id, groupId, content, createdAt: new Date() });
  revalidatePath("/community");
  revalidatePath("/feed");
  redirectWith("Post published.");
}

export function joinedGroupOrder() {
  return [desc(groups.createdAt), desc(groups.id)] as const;
}

export function recommendedGroupOrder() {
  return [desc(groups.memberCount), desc(groups.id)] as const;
}

export function feedOrder() {
  return [desc(posts.createdAt), desc(posts.id)] as const;
}

export async function getJoinedGroups(userId: number, limit = 12, offset = 0) {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      memberCount: groups.memberCount,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(...joinedGroupOrder())
    .limit(limit)
    .offset(offset);
}

export async function getRecommendedGroups(limit = 6) {
  return db.select().from(groups).orderBy(...recommendedGroupOrder()).limit(limit);
}

export async function getRecentPosts(limit = 12) {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      username: users.username,
      groupName: groups.name,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(groups, eq(posts.groupId, groups.id))
    .orderBy(...feedOrder())
    .limit(limit);
}
