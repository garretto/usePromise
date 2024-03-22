import {useState, useCallback} from 'react'

/*

Example Usages:

// Simplest example with catch and onSuccess
function MyComponent() {
  const [handleMyPromise, {isLoading, error, data}] = usePromise(myPromise, {
    // If specified, errors will be caught and passed to this function. If not specified, errors will be re-thrown.
    catch: (error): void => logError(error),
    onSuccess: (data): void => trackSuccessEvent(data),
  })

  if (isLoading) {
    return <Loading />
  }
  if (error) {
    return <Error error={error} />
  }

  return <TemplateComponent data={data} onClick={handleMyPromise} />
}

// Example with try/catch block
function MyOtherComponent() {
  const [handleMyPromise, {isLoading, error, data}] = usePromise(myPromise)

  const handleClick = async () => {
    try {
      const result = await handleMyPromise()
      trackSuccessEvent(result.data)
      navigate()
    } catch (error) {
      logError(error)
    }
  }

  if (isLoading) {
    return <Loading />
  }
  if (error) {
    return <Error error={error} />
  }

  return <TemplateComponent data={data} onClick={handleClick} />
}

// Example with multiple sequential promises with catch: true option 
function MyComplicatedComponent() {
  const [handleMyPromise, {isLoading, error, data}] = usePromise(myPromise, {
    catch: true,
  })  

  const [handleOtherPromise, {isLoadingOther, errorOther, dataOther}] = usePromise(myPromise, {
    catch: true,
  })

  // This is a contrived example, but it shows how you can chain promises together,
  // without multiple try/catch blocks for different error messages.
  const handleComplexClick = async () => {
    const result = await handleMyPromise("some", "args")
    if (result.caughtError) {
      // we don't want to continue if the first promise fails
      // this is annoying to do with multiple try/catch blocks or .then() chains,
      // with different error messages for each promise
      logError(result.caughtError)
      return 
    }
    trackSuccessEvent(result.data)
    const otherResult = await handleOtherPromise(result.data)
    if (otherResult.caughtError) {
      logOtherError(otherResult.caughtError, 'different error')
      navigateSomewhere()
      return
    }
    trackOtherSuccessEvent(otherResult.data)
    if (otherResult.data === 'some value') { 
      navigateSomewhereElse()
    }
  }

  if (isLoading || isLoadingOther) {
    return <Loading />
  }
  if (error) {
    return <Error error={error} />
  }
  if (errorOther) {
    return <Error error={errorOther} />
  }

  return (
    <TemplateComponent data={data} onClick={handleComplexClick}>
      <OtherComponent data={dataOther} />
    />
  )
}
*/

type Result<T> = {data: T; caughtError: undefined} | {data: undefined; caughtError: unknown}

/**
 * Handy hook to get loading and error states for a promises in a component.
 *
 * @param promise The promise to wrap. It will not be executed until it is called later.
 * @param options Optional configuration object.
 * @param options.onSuccess A function to call when the promise resolves successfully.
 * @param options.catch A function to call when the promise rejects/throws. If provided, the error will not be re-thrown.
 * Alternatively, if set to true, the error will be caught and returned in the result object.
 * @returns A tuple containing a function to execute the promise, and an object with loading, error, and data states.
 * [
 *  executePromise, // The function to execute the promise
 *  {
 *    isLoading, // A boolean indicating if the promise is currently loading
 *    error, // The error that was thrown by the promise, if any
 *    data, // The data that was returned by the promise, if any
 *  }
 * ]
 */
export function usePromise<T, U extends any[]>( // eslint-disable-line @typescript-eslint/no-explicit-any
  promise: (...args: U) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    catch?: ((error: unknown) => void) | true
  },
): [(...args: U) => Promise<Result<T>>, {isLoading: boolean; error?: unknown; data?: T}] {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<unknown>(undefined)
  const [data, setData] = useState<T | undefined>(undefined)

  const executePromise = useCallback(
    async (...args: U): Promise<Result<T>> => {
      setIsLoading(true)
      setError(undefined)
      setData(undefined)

      try {
        const data = await promise(...args)
        setData(data)
        options?.onSuccess?.(data)
        return {data, caughtError: undefined}
      } catch (error) {
        setError(error)

        if (options?.catch) {
          if (typeof options.catch === 'function') {
            options.catch(error)
          }
          return {data: undefined, caughtError: error}
        }
        // if catch is not provided, then re-throw/reject
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [promise, options],
  )

  return [executePromise, {isLoading, error, data}]
}

export function usePromiseList<T extends any[]>( // eslint-disable-line @typescript-eslint/no-explicit-any
  promises: Array<() => Promise<T>>,
): [() => void, {isLoading: boolean; errors: unknown[]; data: T[]}] {
  const [state, setState] = useState<{isLoading: boolean; errors: unknown[]; data: T[]}>({
    isLoading: false,
    errors: [],
    data: [],
  })

  const executePromises = useCallback(async () => {
    setState({isLoading: true, errors: [], data: []})
    const results = await Promise.allSettled(promises.map((promise) => promise()))

    const errors: Array<unknown> = []
    const data: Array<T> = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        data[index] = result.value
      } else {
        errors[index] = result.reason
      }
    })

    setState({isLoading: false, errors, data})
  }, [promises])

  return [executePromises, state]
}
