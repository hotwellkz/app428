import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { app } from './config';
import { db } from './config';
import { createCompany, addCompanyUser } from './companies';

export const auth = getAuth(app);

/**
 * Возвращает ID-токен текущего пользователя Firebase Auth.
 * Использовать для Authorization в API (не useAuth().user — там объект из Firestore без getIdToken).
 */
export async function getAuthToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken();
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[auth] getAuthToken failed', e);
    return null;
  }
}

const DEV_LOG = import.meta.env.DEV;
function devLog(...args: unknown[]) {
  if (DEV_LOG) console.log('[RegisterCompany]', ...args);
}

/** Преобразование кода ошибки Firebase Auth (регистрация) в сообщение для пользователя. */
function authErrorMessage(code: string, defaultMsg: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Этот email уже зарегистрирован';
    case 'auth/invalid-email':
      return 'Некорректный email';
    case 'auth/weak-password':
      return 'Пароль должен быть не менее 6 символов';
    case 'auth/operation-not-allowed':
      return 'Регистрация по email отключена. Включите метод «Email/Пароль» в Firebase Console: Authentication → Sign-in method.';
    case 'auth/too-many-requests':
      return 'Слишком много попыток. Попробуйте позже.';
    default:
      return defaultMsg;
  }
}

/** Преобразование кода ошибки Firebase Auth (логин) в человеко-понятное сообщение на русском. */
function authLoginErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Неверный email или пароль';
    case 'auth/user-not-found':
      return 'Аккаунт с таким email не найден';
    case 'auth/invalid-email':
      return 'Некорректный формат email';
    case 'auth/too-many-requests':
      return 'Слишком много попыток входа. Попробуйте чуть позже';
    case 'auth/network-request-failed':
      return 'Ошибка сети. Проверьте подключение к интернету';
    default:
      return 'Не удалось войти в систему. Попробуйте ещё раз';
  }
}

const GLOBAL_ADMIN_EMAILS: string[] = (import.meta.env.VITE_APPROVED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Регистрация новой компании: 1) Auth, 2) company, 3) users (один раз с companyId и isApproved), 4) company_users, 5) проверка, 6) profile. */
export const registerCompanyUser = async (
  companyName: string,
  email: string,
  password: string,
  ownerDisplayName?: string
) => {
  try {
    devLog('uid (will set after Auth)', 'start');
    // 1. Создать пользователя Firebase Auth (автоматический логин)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const uid = user.uid;
    devLog('uid', uid);

    const displayName = (ownerDisplayName ?? companyName).trim() || companyName.trim();
    const isGlobalAdmin = GLOBAL_ADMIN_EMAILS.includes((email || '').toLowerCase());
    const role = isGlobalAdmin ? 'global_admin' : 'owner';

    // 2. Создать компанию (нужен companyId до записи users)
    const companyId = await createCompany(companyName.trim(), uid);
    devLog('created companyId', companyId);

    // 3. Один раз записать users/{uid} с полным контрактом (без промежуточного companyId: null)
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName,
      role,
      companyId,
      isApproved: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    devLog('users written: yes');

    // 4. Создать company_users/{uid} с полным контрактом
    await addCompanyUser(companyId, uid, 'owner', email);
    devLog('company_users written: yes');

    // 5. Проверка перед редиректом: все три документа есть и companyId совпадает
    const [userSnap, cuSnap, companySnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'company_users', uid)),
      getDoc(doc(db, 'companies', companyId))
    ]);
    const userData = userSnap.exists() ? userSnap.data() : null;
    const cuData = cuSnap.exists() ? cuSnap.data() : null;
    const companyExists = companySnap.exists();

    if (!userSnap.exists()) {
      devLog('redirect allowed: no', 'users doc missing');
      throw new Error('Регистрация: не создан документ users. Попробуйте войти ещё раз или обратитесь в поддержку.');
    }
    if (!cuSnap.exists()) {
      devLog('redirect allowed: no', 'company_users doc missing');
      throw new Error('Регистрация: не создана связь с компанией. Попробуйте войти ещё раз или обратитесь в поддержку.');
    }
    if (!companyExists) {
      devLog('redirect allowed: no', 'companies doc missing');
      throw new Error('Регистрация: не создана компания. Попробуйте войти ещё раз или обратитесь в поддержку.');
    }
    const uCompanyId = (userData?.companyId as string) ?? null;
    const cuCompanyId = (cuData?.companyId as string) ?? null;
    if (uCompanyId !== companyId || cuCompanyId !== companyId) {
      devLog('redirect allowed: no', 'companyId mismatch', { uCompanyId, cuCompanyId, companyId });
      throw new Error('Регистрация: несовпадение данных компании. Попробуйте войти ещё раз или обратитесь в поддержку.');
    }
    const isApprovedWritten = userData?.isApproved === true;
    devLog(
      'users.companyId', uCompanyId,
      'company_users.companyId', cuCompanyId,
      'isApproved written:', isApprovedWritten ? 'yes' : 'no',
      'redirect allowed: yes'
    );

    // 6. Обновить profile Auth
    await updateProfile(user, { displayName });

    return user;
  } catch (err: unknown) {
    const authErr = err as { code?: string; message?: string };
    if (authErr?.code) {
      throw new Error(authErrorMessage(authErr.code, authErr.message || 'Ошибка при регистрации'));
    }
    throw err;
  }
};

/** Регистрация без привязки к компании запрещена (multi-tenant). Используйте «Создать компанию» или «Присоединиться по приглашению». */
export const registerUser = async (_email: string, _password: string, _displayName: string) => {
  throw new Error(
    'Нельзя зарегистрироваться без компании. Используйте «Создать компанию» или «Присоединиться по приглашению».'
  );
};

/** Создать документ users/{uid}, если его нет (fallback при логине или при загрузке приложения). */
export async function ensureUserDoc(uid: string, email: string | null): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;

  let companyId: string | null = null;
  const cuRef = doc(db, 'company_users', uid);
  const cuSnap = await getDoc(cuRef);
  if (cuSnap.exists() && cuSnap.data()?.companyId) {
    companyId = cuSnap.data()!.companyId as string;
  }
  if (!companyId) {
    const companiesSnap = await getDocs(
      query(collection(db, 'companies'), where('ownerId', '==', uid))
    );
    if (!companiesSnap.empty) companyId = companiesSnap.docs[0].id;
  }

  await setDoc(userRef, {
    email: email ?? null,
    displayName: null,
    role: 'owner',
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      await ensureUserDoc(uid, userCredential.user.email ?? email);
    }

    return userCredential.user;
  } catch (error: any) {
    console.error('Ошибка при входе:', error?.code, error?.message);
    const code: string | undefined = error?.code;
    const message = code ? authLoginErrorMessage(code) : 'Не удалось войти в систему. Попробуйте ещё раз';
    throw new Error(message);
  }
};

/** Вход по custom token (после принятия приглашения через backend). */
export const loginWithCustomToken = async (customToken: string) => {
  const userCredential = await signInWithCustomToken(auth, customToken);
  return userCredential.user;
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('Ошибка при выходе из системы');
  }
};

// Функция для проверки роли пользователя
export const getUserRole = async (uid: string): Promise<string> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return 'user';
    }
    return userDoc.data().role;
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'user';
  }
};

// Функция для получения всех пользователей
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};