import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { app } from './config';
import { db } from './config';
import { createCompany, addCompanyUser } from './companies';

export const auth = getAuth(app);

const DEV_LOG = import.meta.env.DEV;
function devLog(...args: unknown[]) {
  if (DEV_LOG) console.log('[RegisterCompany]', ...args);
}

/** Преобразование кода ошибки Firebase Auth в сообщение для пользователя. */
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

const GLOBAL_ADMIN_EMAILS: string[] = (import.meta.env.VITE_APPROVED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Регистрация новой компании: 1) Auth, 2) company, 3) users (один раз с companyId и isApproved), 4) company_users, 5) проверка, 6) profile. */
export const registerCompanyUser = async (
  companyName: string,
  email: string,
  password: string
) => {
  try {
    devLog('uid (will set after Auth)', 'start');
    // 1. Создать пользователя Firebase Auth (автоматический логин)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const uid = user.uid;
    devLog('uid', uid);

    const isGlobalAdmin = GLOBAL_ADMIN_EMAILS.includes((email || '').toLowerCase());
    const role = isGlobalAdmin ? 'global_admin' : 'owner';

    // 2. Создать компанию (нужен companyId до записи users)
    const companyId = await createCompany(companyName.trim(), uid);
    devLog('created companyId', companyId);

    // 3. Один раз записать users/{uid} с полным контрактом (без промежуточного companyId: null)
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName: companyName.trim(),
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
    await updateProfile(user, { displayName: companyName.trim() });

    return user;
  } catch (err: unknown) {
    const authErr = err as { code?: string; message?: string };
    if (authErr?.code) {
      throw new Error(authErrorMessage(authErr.code, authErr.message || 'Ошибка при регистрации'));
    }
    throw err;
  }
};

export const registerUser = async (email: string, password: string, displayName: string) => {
  try {
    console.log('Начинаем процесс регистрации для:', email);
    
    // Проверяем инициализацию Firebase
    if (!auth) {
      console.error('Firebase Auth не инициализирован');
      throw new Error('Ошибка инициализации Firebase');
    }

    // Создаем пользователя
    console.log('Создаем пользователя в Firebase Auth...');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Пользователь успешно создан в Firebase Auth:', userCredential.user.uid);
    
    // Создаем запись в Firestore
    console.log('Создаем запись пользователя в Firestore...');
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      displayName,
      role: 'user',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('Запись в Firestore успешно создана');

    // Обновляем профиль
    console.log('Обновляем displayName пользователя...');
    await updateProfile(userCredential.user, { displayName });
    console.log('Профиль пользователя успешно обновлен');

    return userCredential.user;
  } catch (error: any) {
    console.error('Ошибка при регистрации:', error.code, error.message);
    switch (error.code) {
      case 'auth/email-already-in-use':
        throw new Error('Этот email уже используется');
      case 'auth/invalid-email':
        throw new Error('Некорректный email');
      case 'auth/weak-password':
        throw new Error('Слишком простой пароль');
      case 'auth/operation-not-allowed':
        console.error('Email/Password регистрация не включена в Firebase Console');
        throw new Error('Регистрация временно недоступна');
      default:
        throw new Error(`Ошибка при регистрации: ${error.message}`);
    }
  }
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
    console.error('Ошибка при входе:', error.code, error.message);
    switch (error.code) {
      case 'auth/invalid-email':
        throw new Error('Некорректный email');
      case 'auth/user-disabled':
        throw new Error('Аккаунт заблокирован');
      case 'auth/user-not-found':
        throw new Error('Пользователь не найден');
      case 'auth/wrong-password':
        throw new Error('Неверный пароль');
      default:
        throw new Error(`Ошибка при входе: ${error.message}`);
    }
  }
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